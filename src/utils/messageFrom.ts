/**
 * 归一化错误消息
 * @param v 可能是 Error 或者别的什么玩意
 * @param defaultMsg 默认消息
 * @returns 归一化后的错误消息
 * @example
 * ```
 * try {
 *   // do something
 * } catch (err) {
 *   console.error(messageFrom(err))
 * }
 * ```
 */
export const messageFrom = (v: unknown, defaultMsg = ''): string => {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.message
  if (v === null || v === undefined) return defaultMsg
  return `${v}`
}
