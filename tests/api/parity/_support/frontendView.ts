import type { RawResult } from './client'

/**
 * 前端 alova 封装层「可见行为」推导
 *
 * 严格复刻：
 *  - 共享实例 src/api/alova/index.ts:52-80
 *  - OAuth 实例 src/api/oauth/oauth.ts:21-64
 *
 * 输入是**真实采集的原始 HTTP 响应**（RawResult），不是模拟数据；
 * 输出是前端调用方实际能观察到的结果：抛什么错、拿到什么对象、是否触发登出、
 * 能看到哪些顶层字段。这样既保留「原始状态码 / 响应头 / 错误码」的完整比对，
 * 又补上「前端封装层视角」的对齐，回应「站在前端调用方视角」的任务要求。
 */
export type FrontendLayer = 'shared-alova' | 'oauth-alova'

export type FrontendView = {
  layer: FrontendLayer
  outcome: 'throw' | 'return-data' | 'return-raw-response'
  errorText: string | null
  errorSource: 'statusText' | 'message' | 'error_description' | 'errorData' | null
  logoutTriggered: boolean
  visibleKind: 'parsed-json' | 'raw-response' | 'none'
  visibleTopKeys: string[]
  contentTypeMatched: boolean
  bodyWasJson: boolean
}

const asText = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  return undefined
}

export function deriveFrontendView(res: RawResult, layer: FrontendLayer): FrontendView {
  const bodyIsObject = res.body !== null && typeof res.body === 'object' && !Array.isArray(res.body)
  const body: Record<string, any> = bodyIsObject ? res.body : {}
  const base: FrontendView = {
    layer,
    outcome: 'return-data',
    errorText: null,
    errorSource: null,
    logoutTriggered: res.status === 401 || res.status === 403,
    visibleKind: bodyIsObject ? 'parsed-json' : 'none',
    visibleTopKeys: bodyIsObject ? Object.keys(body).sort() : [],
    contentTypeMatched: res.contentType === 'application/json',
    bodyWasJson: bodyIsObject,
  }

  // 两个实例都把 2xx-3xx 之外的状态码转成 Error(statusText)，并触发登出
  if (res.status < 200 || res.status >= 400) {
    return {
      ...base,
      outcome: 'throw',
      errorText: res.statusText || null,
      errorSource: 'statusText',
      visibleKind: 'none',
      visibleTopKeys: [],
    }
  }

  // 共享实例：contentType 不是精确的 'application/json' 时原样返回 Response 对象
  if (layer === 'shared-alova' && !base.contentTypeMatched) {
    return {
      ...base,
      outcome: 'return-raw-response',
      visibleKind: 'raw-response',
      visibleTopKeys: ['<Response>'],
    }
  }

  // 两个实例都会把 body 里的 error 标记映射成异常
  if (body.error) {
    const candidates: [FrontendView['errorSource'], string | undefined][] = [
      ['message', asText(body.message)],
      ['error_description', asText(body.error_description)],
      ['errorData', asText(body.errorData)],
      ['statusText', res.statusText],
    ]
    const picked = candidates.find(([, value]) => Boolean(value))
    return {
      ...base,
      outcome: 'throw',
      errorText: picked?.[1] ?? res.statusText ?? null,
      errorSource: picked?.[0] ?? 'statusText',
      visibleKind: 'none',
      visibleTopKeys: [],
    }
  }

  return base
}
