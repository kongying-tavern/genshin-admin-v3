import type { ValuePacker } from '../types'
import type { MAFValue, MAFValueString } from '@/stores/types'
import { ByteReader, ByteWriter } from '@/utils'

const isValidNumber = (num: number): boolean =>
  Number.isInteger(num) && num > 0 && num <= 2 ** 32 - 1

type IdRangeItem = number | [number, number]

/** 与 modelIdRange.prepare 一致的解析逻辑 */
const parse = (s: string): IdRangeItem[] => {
  const items: IdRangeItem[] = []
  if (!s) return items
  s.split(',')
    .filter(v => v)
    .forEach(group => {
      if (group.includes('-')) {
        const nums = group.split('-')
        const num1 = Number(nums.shift())
        const num2 = Number(nums.join('-'))
        if (isValidNumber(num1) && isValidNumber(num2) && num2 > num1 && num2 - num1 < 1e6)
          items.push([num1, num2])
      } else {
        const num = Number(group)
        if (isValidNumber(num)) items.push(num)
      }
    })
  return items
}

/**
 * ID 范围编码格式：
 *   u8 组数（最大 255，过多的分组会被截断）
 *   类型位图 ceil(count/8) 字节（每组 1bit 依次排列，1=区间，0=单值）
 *   数据区（单值 1 个 u32，区间 2 个 u32，按类型位图顺序）
 */
const encode = (value: MAFValue): Uint8Array => {
  const items = parse((value as MAFValueString).s)
  const count = Math.min(items.length, 0b1111_1111)
  const bitmapBytes = Math.ceil(count / 8)
  const writer = new ByteWriter().writeUint8(count, 'clamp')

  // 类型位图：依次写每组的类型，不移动指针，超过 8 组自动跨字节
  for (let i = 0; i < count; i++) {
    writer.setBit(Array.isArray(items[i]) ? 0b1 : 0b0, i + 1, i + 1)
  }
  writer.moveBy(bitmapBytes)

  // 数据区
  for (let i = 0; i < count; i++) {
    const item = items[i]
    if (Array.isArray(item)) {
      writer.writeUint32LE(item[0], 'clamp')
      writer.writeUint32LE(item[1], 'clamp')
    } else {
      writer.writeUint32LE(item, 'clamp')
    }
  }
  return writer.toUint8Array()
}

const decode = (bytes: Uint8Array): MAFValueString => {
  const reader = new ByteReader(bytes)
  const count = Number(reader.readUint8('blank'))
  const bitmapBytes = Math.ceil(count / 8)

  // 读取类型位图
  const isRanges: boolean[] = []
  for (let i = 0; i < count; i++) isRanges.push(Boolean(reader.readBit(i + 1, i + 1, 'blank')))
  reader.moveBy(bitmapBytes)

  // 读取数据区
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    if (isRanges[i]) {
      const num1 = Number(reader.readUint32LE('blank'))
      const num2 = Number(reader.readUint32LE('blank'))
      if (isValidNumber(num1) && isValidNumber(num2) && num2 > num1) parts.push(`${num1}-${num2}`)
    } else {
      const num = Number(reader.readUint32LE('blank'))
      if (isValidNumber(num)) parts.push(`${num}`)
    }
  }
  return { s: parts.join(',') }
}

export const customIdRangePacker: ValuePacker = { encode, decode }
