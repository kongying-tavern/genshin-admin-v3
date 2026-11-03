import type { PresetPackContext, ValuePacker } from '../types'
import type { MAFValue, MAFValueStringArray } from '@/stores/types'
import { ByteReader, ByteWriter, md5ToBigInt } from '@/utils'

/**
 * 分层层级编码格式：
 *   连续堆叠 24 位哈希（每个层级 code 的 MD5 前 3 字节，low-endian），无长度前缀，解码遍历到数据结尾
 */
const encode = (value: MAFValue): Uint8Array => {
  const { sa } = value as MAFValueStringArray
  const writer = new ByteWriter()
  for (const code of sa) {
    const hash = md5ToBigInt(code, 1, 3)
    writer.writeBytes(
      new Uint8Array([
        Number(hash & 0xffn),
        Number((hash >> 8n) & 0xffn),
        Number((hash >> 16n) & 0xffn),
      ]),
    )
  }
  return writer.toUint8Array()
}

/** 解码依赖映射表反查还原 code；表中不存在（不同数据源）时跳过 */
const decode = (bytes: Uint8Array, context: PresetPackContext): MAFValueStringArray => {
  const reader = new ByteReader(bytes)
  const { undergroundHashToCodeMap } = context
  const sa: string[] = []

  while (reader.remaining >= 3) {
    const [b0, b1, b2] = reader.readBytes(3, 'blank')
    const hash = BigInt(b0) | (BigInt(b1) << 8n) | (BigInt(b2) << 16n)
    const code = undergroundHashToCodeMap.get(hash)
    if (code) sa.push(code)
  }
  return { sa }
}

export const customUndergroundLayerPacker: ValuePacker = { encode, decode }
