/**
 * 常见纯网络错误的消息特征
 *
 * 包括三类：
 * 1. fetch/axios 的 TypeError 网络错误（如 Failed to fetch / Network Error）
 * 2. 浏览器底层连接错误码（如 ERR_CONNECTION_RESET / ERR_PROTOCOL_ERROR 等）
 * 3. 超时 / 请求被中止
 */
const NETWORK_ERROR_PATTERNS = [
  // fetch API 原生错误
  'Failed to fetch',
  'NetworkError',
  'Load failed',
  'Network request failed',

  // axios 网络错误
  'Network Error',

  // 浏览器错误码
  'ERR_CONNECTION_RESET',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_CLOSED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_PROTOCOL_ERROR',
  'ERR_EMPTY_RESPONSE',
  'ERR_CONTENT_DECODING_FAILED',
  'ERR_INCOMPLETE_CHUNKED_ENCODING',
  'ERR_NETWORK_CHANGED',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_ADDRESS_UNREACHABLE',
  'ERR_TUNNEL_CONNECTION_FAILED',
  'ERR_SSL_PROTOCOL_ERROR',

  // 超时 / 中止
  'timeout',
  'The operation was aborted',
  'AbortError',
]

/**
 * 判断错误是否为纯网络层错误（非业务错误、非鉴权错误）
 *
 * 纯网络错误不应触发登出等业务副作用，避免因 VPN / 网络波动
 * 导致用户被误踢下线。
 *
 * @param err 任意错误对象或值
 * @returns 是否为纯网络错误
 */
export const isNetworkError = (err: unknown): boolean => {
  if (!err) return false

  const message = (
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  ).toLowerCase()
  if (!message) return false

  // 针对 fetch/axios 特殊类型：TypeError 通常就是网络错误
  if (err instanceof TypeError) return true

  return NETWORK_ERROR_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()))
}
