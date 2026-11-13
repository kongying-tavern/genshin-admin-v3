import { apiBase, basicCredentials, envStamp, runId } from './env'

export type RequestOptions = {
  method?: string
  path: string
  /** 普通对象 -> JSON；FormData/URLSearchParams/string -> 原样透传 */
  body?: unknown
  token?: string | null
  basic?: boolean
  headers?: Record<string, string>
  timeoutMs?: number
}

export type RawResult = {
  ok: boolean
  status: number
  statusText: string
  contentType: string | null
  headers: Record<string, string>
  bodyText: string
  body: any
  ms: number
  networkError?: string
}

const basicHeader = () =>
  `Basic ${Buffer.from(`${basicCredentials.username}:${basicCredentials.password}`, 'utf8').toString('base64')}`

/**
 * 原生 fetch 旁路采集。
 *
 * 刻意不复用 src/api/alova：共享实例的 `responded` 会把 status>=400 转成 Error(statusText)、
 * 把 200 + error:true 转成 Error(message)，导致原始状态码 / 响应头 / 业务错误码全部丢失，
 * 无法完成「前端可观测行为」比对。这里保留最原始的 HTTP 响应。
 */
export async function rawRequest(options: RequestOptions): Promise<RawResult> {
  const {
    method = 'GET',
    path,
    body,
    token,
    basic,
    headers: extraHeaders = {},
    timeoutMs = 30_000,
  } = options

  const headers: Record<string, string> = {
    // 测试专用标志：便于后端日志定位本次测试流量，同时不改动任何后端实现
    'X-Parity-Run-Id': runId,
    ...extraHeaders,
  }
  if (basic) headers.Authorization = basicHeader()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload: BodyInit | undefined
  if (body instanceof FormData || body instanceof URLSearchParams || typeof body === 'string') {
    payload = body as BodyInit
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const started = Date.now()
  let response: Response
  let bodyText: string
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      body: payload,
      signal: AbortSignal.timeout(timeoutMs),
    })
    bodyText = await response.text()
  } catch (error) {
    // 网络不可达一律返回可判定的结果，由用例显式抛错；绝不 skip
    return {
      ok: false,
      status: 0,
      statusText: '',
      contentType: null,
      headers: {},
      bodyText: '',
      body: undefined,
      ms: Date.now() - started,
      networkError: String(error instanceof Error ? error.message : error),
    }
  }

  let parsed: any = bodyText
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    // 非 JSON 响应保留原始文本（截断，避免二进制内容进入快照）
    parsed = bodyText.slice(0, 4096)
  }

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get('content-type'),
    headers: Object.fromEntries(response.headers.entries()),
    bodyText,
    body: parsed,
    ms: Date.now() - started,
  }
}

/** 便捷方法：携带当前会话 token 的 JSON 请求 */
export const api = (token: string | null, method: string, path: string, body?: unknown) =>
  rawRequest({ method, path, body, token })

/** 登录表单体，与前端 src/api/oauth/oauth.ts 保持一致（FormData） */
export const buildLoginForm = (username: string, password: string) => {
  const form = new FormData()
  form.append('grant_type', 'password')
  form.append('username', username)
  form.append('password', password)
  return form
}

export const requestStamp = (method: string, path: string) => ({ ...envStamp, method, path })
