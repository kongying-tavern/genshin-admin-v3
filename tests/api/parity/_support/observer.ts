import fs from 'node:fs'
import path from 'node:path'
import type { RawResult } from './client'
import { apiBase, envFile, envStamp, parityEnv, runId, SNAPSHOT_DIR } from './env'

/**
 * 观测快照归一化
 *
 * 目标：把「原始 HTTP 响应」转成可逐字段比对的结构，同时不把动态噪声
 * （id / 时间戳 / 令牌 / 数组长度波动）误判成环境差异。
 *
 * 规则：
 *  - VALUE_KEYS 内的标量保留精确值（状态码、业务错误码、消息文案、会话有效期等）
 *  - 敏感 / 动态键只保留类型，值一律不落盘
 *  - 数组只保留元素结构类型，长度单独记为信息项（共享库下数据量会随时序变化）
 *  - 对象按 key 排序后递归，键集合差异（如 Rust 多出 iconTag）会被暴露
 */

const VALUE_KEYS = new Set([
  'error', 'errorstatus', 'messagestatus', 'message', 'statustext', 'token_type', 'tokentype',
  'scope', 'env', 'expires_in', 'expiresin', 'isfinal', 'hiddenflag', 'specialflag',
  'sortindex', 'sort', 'linkaction', 'linkreverse', 'linkstate', 'granted', 'enabled',
])

const TYPE_ONLY_KEYS = new Set([
  'id', 'userid', 'creatorid', 'updaterid', 'areaid', 'itemid', 'markerid', 'iconid',
  'typeid', 'parentid', 'groupid', 'fromid', 'toid', 'version', 'createtime', 'updatetime',
  'time', 'date', 'timestamp', 'expirestime', 'refreshtime', 'jti', 'total', 'size',
  'count', 'current', 'pages', 'sort', 'code', 'position', 'url', 'logo', 'phone', 'qq',
])

const isTypeOnly = (key: string): boolean => {
  const k = key.toLowerCase()
  if (TYPE_ONLY_KEYS.has(k)) return true
  if (/token|password|secret|auth|cookie|session|sign|hash|md5/i.test(k)) return true
  if (/(id|time|date|stamp)$/.test(k)) return true
  return false
}

export function semanticOf(value: unknown, key = '', depth = 0, lengths: Record<string, number> = {}): unknown {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) {
    if (key) lengths[`${key}[]`] = value.length
    return { __array__: value.length ? semanticOf(value[0], key, depth + 1, lengths) : 'empty' }
  }
  if (typeof value === 'object') {
    if (depth > 6) return 'object'
    const keys = Object.keys(value as object).sort()
    // 动态字典（users、以 groupId 为键的 data 等）的键集合随时序与共享库状态变化。
    // 折叠成统一形态，避免逐键比对产生上千条噪声；「空 vs 非空」差异仍通过 <keys> 暴露。
    if (keys.length > 8) {
      lengths[`${key || 'object'}#dictSize`] = keys.length
      return { __dict__: semanticOf((value as Record<string, unknown>)[keys[0]], key, depth + 1, lengths) }
    }
    const out: Record<string, unknown> = {}
    for (const childKey of keys)
      out[childKey] = semanticOf((value as Record<string, unknown>)[childKey], childKey, depth + 1, lengths)
    return out
  }

  const type = typeof value
  if (type === 'string' || type === 'number' || type === 'boolean') {
    const lower = key.toLowerCase()
    // data 字段只在是布尔值 / 短字符串时保留值（新建实体返回的 id 必须屏蔽）
    if (lower === 'data') {
      if (typeof value === 'boolean') return value
      if (typeof value === 'string' && value.length < 64) return value
      return type
    }
    if (VALUE_KEYS.has(lower) && !isTypeOnly(key)) return value
    return type
  }
  return type
}

/** 屏蔽每次请求都会变的头，其余响应头（含安全头）原样参与比对 */
const VOLATILE_HEADERS = new Set(['date', 'content-length', 'set-cookie', 'etag', 'age', 'x-request-id', 'x-envoy-upstream-service-time'])

export function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = rawKey.toLowerCase()
    if (VOLATILE_HEADERS.has(key)) {
      out[key] = `<volatile:${key}>`
      continue
    }
    out[key] = rawValue
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}

export type Observation = {
  caseId: string
  tags: string[]
  env: string
  envFile: string
  baseUrl: string
  wsBase: string
  runId: string
  capturedAt: string
  /** 两套后端共享同一数据库，差异归因必须考虑执行顺序与状态残留 */
  sharedDatabase: boolean
  sharedDatabaseEvidence: string
  request: {
    method: string
    path: string
    bodyShape: unknown
    authMode: string
    testHeaderInjected: boolean
  }
  response: {
    status: number
    statusText: string
    contentType: string | null
    headers: Record<string, string>
    headerKeys: string[]
    topKeyOrder: string[]
    semantic: unknown
    arrayLengths: Record<string, number>
    message: unknown
    errorFlag: unknown
    errorStatus: unknown
    ms: number
  }
  ws?: unknown
  /** 前端 alova 封装层可见行为（由 frontendView.ts 从真实响应推导） */
  frontend?: unknown
  note?: string
}

export type CaptureInput = {
  res: RawResult
  method?: string
  path?: string
  body?: unknown
  authMode?: string
  ws?: unknown
  /** 前端 alova 封装层可见行为（由 frontendView.ts 从真实响应推导） */
  frontend?: unknown
  note?: string
}

const safeName = (caseId: string) => caseId.replace(/[^\w.-]/g, '_')

export function recordObservation(obs: Observation): void {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
  fs.writeFileSync(path.join(SNAPSHOT_DIR, `${safeName(obs.caseId)}.json`), JSON.stringify(obs, null, 2))
}

/**
 * 采集一条观测。
 * 网络层失败一律抛错（不 skip）——否则 Rust 环境挂掉也会被误判为「已对齐」。
 */
export async function capture<T extends CaptureInput>(
  caseId: string,
  tags: string[],
  run: () => Promise<T>,
): Promise<T> {
  const input = await run()
  const { res } = input
  if (!res.ok || res.networkError || res.status === 0)
    throw new Error(
      `[parity] ${caseId} @ ${parityEnv}(${envFile}) 未取得真实 HTTP 响应：${res.networkError ?? 'empty response'}`,
    )

  const lengths: Record<string, number> = {}
  const semantic = semanticOf(res.body, '', 0, lengths)
  const bodyIsObject = res.body !== null && typeof res.body === 'object' && !Array.isArray(res.body)

  const obs: Observation = {
    caseId,
    tags,
    env: parityEnv,
    envFile,
    baseUrl: apiBase,
    wsBase: envStamp.wsBase,
    runId,
    capturedAt: new Date().toISOString(),
    sharedDatabase: envStamp.sharedDatabase,
    sharedDatabaseEvidence: envStamp.sharedDatabaseEvidence,
    request: {
      method: input.method ?? 'GET',
      path: input.path ?? '',
      bodyShape: input.body instanceof FormData ? 'FormData' : semanticOf(input.body ?? null, '', 0, {}),
      authMode: input.authMode ?? 'none',
      testHeaderInjected: true,
    },
    response: {
      status: res.status,
      statusText: res.statusText,
      contentType: res.contentType,
      headers: normalizeHeaders(res.headers),
      headerKeys: Object.keys(normalizeHeaders(res.headers)),
      topKeyOrder: bodyIsObject ? Object.keys(res.body) : Array.isArray(res.body) ? ['<array>'] : ['<scalar>'],
      semantic,
      arrayLengths: lengths,
      message: bodyIsObject ? (res.body as any).message ?? null : null,
      errorFlag: bodyIsObject ? (res.body as any).error ?? null : null,
      errorStatus: bodyIsObject ? (res.body as any).errorStatus ?? null : null,
      ms: res.ms,
    },
    ws: input.ws,
    frontend: input.frontend,
    note: input.note,
  }

  // ---- 采集有效性与溯源正确性的自洽断言 ----
  // 只在「采集本身是否可信」上设卡，不对 Java/Rust 的行为差异作任何判定，
  // 因此不会因单端差异而红灯中断全量采集；差异一律交给离线 diff 裁决。
  if (obs.response.status < 100 || obs.response.status >= 600)
    throw new Error(`[parity] ${caseId} 状态码非法：${obs.response.status}`)
  if (Object.keys(obs.response.headers).length === 0)
    throw new Error(`[parity] ${caseId} 未采集到任何响应头，快照不可信`)
  if (obs.env !== parityEnv || obs.envFile !== envFile || obs.baseUrl !== apiBase)
    throw new Error(`[parity] ${caseId} 环境溯源信息（env/envFile/baseUrl）不一致`)
  if ((obs.response.contentType ?? '').includes('json') && res.bodyText.trim() === '')
    throw new Error(`[parity] ${caseId} 声明为 JSON 但响应体为空，响应解析可能失败`)
  if (input.frontend !== undefined && input.frontend === null)
    throw new Error(`[parity] ${caseId} 前端封装层视图为空，采集不完整`)

  recordObservation(obs)
  return input
}
