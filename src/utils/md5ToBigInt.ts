import { md5 } from 'js-md5'

/**
 * MD5 摘要指定区间字节转为 bigint（little-endian 字节序，区间起始字节为低位）
 * @param input 原始字符串
 * @param byteStart 起始字节序号（含，1-based）
 * @param byteEnd 结束字节序号（含，1-based）
 */
export function md5ToBigInt(input: string, byteStart: number, byteEnd: number): bigint {
  const bytes = new Uint8Array(md5.arrayBuffer(input))
  const end = Math.min(byteEnd, bytes.length)
  let value = 0n
  for (let i = end - 1; i >= byteStart - 1; i--) value = (value << 8n) | BigInt(bytes[i])
  return value
}
