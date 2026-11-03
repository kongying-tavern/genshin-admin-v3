export interface ByteSizeFormatterOptions {
  /** 是否使用二进制计量方式 @default true */
  binary?: boolean

  /** 小数位 @default 1 */
  decimal?: number
}

/**
 * @example
 * ```
 * // 二进制计量方式
 * formatByteSize(1024) // '1 KiB'
 *
 * // 普通千分计量方式
 * formatByteSize(1024, { binary: false }) // '1.024 KB'
 * ```
 */
export const formatByteSize = (byteLength: number, options: ByteSizeFormatterOptions = {}) => {
  const { binary = true, decimal = 1 } = options

  const measureUnits = binary
    ? ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
    : ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const base = binary ? 1024 : 1000

  let size = byteLength
  let unit = 'Byte'

  for (let i = 0; i < measureUnits.length; i++) {
    const nextUnit = measureUnits[i]
    if (!nextUnit) return `${size.toFixed(decimal)} ${unit}`
    if (size < base) return `${size.toFixed(decimal)} ${unit}`
    size /= base
    unit = nextUnit
  }

  return `${size.toFixed(decimal)} ${unit}`
}
