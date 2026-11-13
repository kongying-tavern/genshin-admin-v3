/**
 * protobuf 的 `uint64` / `int64` 在存在 `long` 依赖时会被解码成 Long 实例
 * （形如 `{ low: 10853, high: 0, unsigned: true }`），而不是普通数值。
 *
 * 这类实例一旦被当成 number 使用就会出现：
 * - `JSON.stringify` 后变成 `{ low, high, unsigned }` 对象，请求体与接口约定不符；
 * - 作为 `Map` 的键时永远匹配不上数值键，导致差异比对整体失效；
 * - 作为 IndexedDB 的主键时会被判定为非法键，写入直接失败。
 *
 * 因此所有二进制协议出口处都必须经过一次数值收敛。
 */
export interface LongLike {
  low: number
  high: number
  unsigned?: boolean
  /** 安装了 long 库时存在的实例方法 */
  toNumber?: () => number
}

export type ProtobufInteger = number | LongLike | null | undefined

const UINT32_BASE = 0x100000000

const isLongLike = (value: unknown): value is LongLike =>
  typeof value === 'object' && value !== null && 'low' in value && 'high' in value

/**
 * 将 protobuf 的 64 位整型收敛为 number
 * @param fallback 无法解析时返回的兜底值
 */
export const toNumber = (value: ProtobufInteger, fallback = 0): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (value === null || value === undefined) return fallback

  if (typeof value.toNumber === 'function') {
    const next = value.toNumber()
    return Number.isFinite(next) ? next : fallback
  }

  if (isLongLike(value)) {
    const low = value.low >>> 0
    // `unsigned` 缺省时与 long 库保持一致，按无符号处理
    if (value.unsigned === false) return (value.high | 0) * UINT32_BASE + low
    return (value.high >>> 0) * UINT32_BASE + low
  }

  return fallback
}

/** 将可能缺省的 protobuf 64 位整型收敛为 number，缺省时保持 undefined */
export const toOptionalNumber = (value: ProtobufInteger): number | undefined => {
  if (value === null || value === undefined) return undefined
  return toNumber(value)
}
