import type { FilterConditions, FilterConditionsAdvanced, FilterConditionsBasic } from '../types'
import { encode } from 'base32768'
import { isNil } from 'lodash'
import { ByteWriter } from '@/utils'
import { getValuePacker, isAdvancedFilter, toConditionsBaseMap } from '../utils'

/** 将原始数据压缩为二进制与分享码（依赖 store 数据） */
export function usePresetZip(conditions: MaybeRef<FilterConditions | null | undefined>) {
  const binary = computed(() => zip(unref(conditions)))
  const shareCode = computed(() => encode(binary.value))

  return {
    binary,
    shareCode,
  }
}

// ==================== 压缩（TODO：依赖 store 数据） ====================

function zipBasic(conditions: FilterConditionsBasic): Uint8Array {
  const writer = new ByteWriter()

  // 第一个字节：先清零，再设置位标记
  // 前两位 0b01 为合规标记，后四位 0b0001 为 basic 过滤类型标记
  // => 二进制 01000001 = 0x41
  writer.setBit(0b0, 1, 8).setBit(0b01, 1, 2).setBit(0b0001, 5, 8).moveBy(1)

  // 无条目数，读取时遍历到字节尾部即可
  // 每条：areaId(u32) + typeId(u32) + item 长度(u8) + 循环 itemId(u32)
  const entries = toConditionsBaseMap(conditions)

  for (const condition of entries.values()) {
    // item 数量以 clamp 后的编码值为准遍历，保持与长度字节一致
    const itemCount = Math.min(condition.items.length, 0b1111_1111)
    writer.writeUint32LE(condition.area.id ?? 0, 'clamp')
    writer.writeUint32LE(condition.type.id ?? 0, 'clamp')
    writer.writeUint8(itemCount, 'clamp')
    for (let i = 0; i < itemCount; i++) writer.writeUint32LE(condition.items[i], 'clamp')
  }

  return writer.toUint8Array()
}

function zipAdvanced(conditions: FilterConditionsAdvanced): Uint8Array {
  const writer = new ByteWriter()

  // 第一个字节：先清零，再设置位标记
  // 前两位 0b01 为合规标记，后四位 0b0010 为 advanced 过滤类型标记
  // => 二进制 01000010 = 0x42
  writer.setBit(0b0, 1, 8).setBit(0b01, 1, 2).setBit(0b0010, 5, 8).moveBy(1)

  // 二进制布局：
  //   Group：
  //     bit 1-2 : operator + opposite
  //     bit 3-8 : children count(6bit, clamp)
  //   Children：
  //     bit 1-2 : operator + opposite
  //     bit 3-8 : id 高位(6bit)
  //     u8      : id 低位(8bit)（id 共 14bit）
  //     u32     : value 字节长度
  //     bytes   : value 字节
  for (const group of conditions) {
    // children 数量以 clamp 后的编码值为准遍历
    const childrenCount = Math.min(group.children.length, 0b111111)
    writer
      .setBit(0b0, 1, 8)
      .setBit(group.operator ? 0b1 : 0b0, 1, 1)
      .setBit(group.opposite ? 0b1 : 0b0, 2, 2)
      .setBit(childrenCount, 3, 8, 'clamp')
      .moveBy(1)

    for (let i = 0; i < childrenCount; i++) {
      const child = group.children[i]

      // id 共 14bit，手动拆分以固定位序：高 6 位在 meta 字节 bit 3-8，低 8 位在下一字节 bit 1-8
      const idHigh = (child.id >> 8) & 0b111111
      const idLow = child.id & 0xff

      writer
        .setBit(0b0, 1, 8)
        .setBit(child.operator ? 0b1 : 0b0, 1, 1)
        .setBit(child.opposite ? 0b1 : 0b0, 2, 2)
        .setBit(idHigh, 3, 8, 'clamp')
        .moveBy(1)
        .setBit(idLow, 1, 8, 'clamp')
        .moveBy(1)

      const valueBytes = getValuePacker(child.id).encode(child.value)

      // value 字节数超出 u32 范围时，长度写 0 且不填数据
      if (valueBytes.length > 0xffff_ffff) {
        writer.writeUint32LE(0)
      } else {
        writer.writeUint32LE(valueBytes.length, 'clamp')
        writer.writeBytes(valueBytes)
      }
    }
  }

  return writer.toUint8Array()
}

function zip(conditions: FilterConditions | null | undefined): Uint8Array {
  if (isNil(conditions)) return new Uint8Array()

  return isAdvancedFilter(conditions) ? zipAdvanced(conditions) : zipBasic(conditions)
}
