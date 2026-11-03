import type { FilterConditions, FilterConditionsAdvanced, FilterConditionsBasic } from '../types'
import type { PresetPackContext } from '../utils'
import type { MAFModelId } from '@/shared'
import type { MAFGroup, MAFItem, MBFItem } from '@/stores/types'
import { decode } from 'base32768'
import { isNil } from 'lodash'
import { storeToRefs } from 'pinia'
import { useAreaStore, useItemTypeStore } from '@/stores'
import { ByteReader } from '@/utils'
import { usePackUndergroundLayerContext } from '.'
import { getBinaryFilterType, getValuePacker, isValidBinaryHead } from '../utils'

/** 将分享码解压为二进制与原始数据（依赖 store 数据） */
export function usePresetUnzip(code: MaybeRef<string | null | undefined>) {
  const { areaIdMap } = storeToRefs(useAreaStore())
  const { itemTypeIdMap } = storeToRefs(useItemTypeStore())
  const { codeToHashMap: undergroundCodeToHashMap, hashToCodeMap: undergroundHashToCodeMap } =
    usePackUndergroundLayerContext()

  const binary = computed(() => {
    const value = unref(code)
    return isNil(value) ? new Uint8Array() : decode(value)
  })
  const conditions = computed(() => {
    return unzip(binary.value, {
      areaIdMap: areaIdMap.value,
      itemTypeIdMap: itemTypeIdMap.value,
      undergroundCodeToHashMap: undergroundCodeToHashMap.value,
      undergroundHashToCodeMap: undergroundHashToCodeMap.value,
    })
  })

  return {
    binary,
    conditions,
  }
}

// ==================== 解压 ====================

function unzipBasic(reader: ByteReader, context: PresetPackContext): FilterConditionsBasic {
  const { areaIdMap, itemTypeIdMap } = context
  const result = new Map<string, MBFItem>()

  while (reader.remaining > 0) {
    const areaId = Number(reader.readUint32LE('blank'))
    const typeId = Number(reader.readUint32LE('blank'))
    const itemCount = Number(reader.readUint8('blank'))

    const items: number[] = []
    for (let i = 0; i < itemCount; i++) items.push(Number(reader.readUint32LE('blank')))

    const area = areaIdMap.get(areaId)
    const type = itemTypeIdMap.get(typeId)
    if (!area || !type) continue

    result.set(`${area.code}-${typeId}`, { area, type, items })
  }

  return result
}

function unzipAdvanced(reader: ByteReader, context: PresetPackContext): FilterConditionsAdvanced {
  const result: FilterConditionsAdvanced = []

  // 二进制布局：
  //   Group：
  //     bit 1-2 : operator + opposite
  //     bit 3-8 : children count(6bit)
  //   Children：
  //     bit 1-2 : operator + opposite
  //     bit 3-8 : id 高位(6bit)
  //     u8      : id 低位(8bit)（id 共 14bit）
  //     u32     : value 字节长度
  //     bytes   : value 字节
  while (reader.remaining > 0) {
    // 读取 Group：readBit 只读不移动指针，读完整个字节后需手动 moveBy(1) 对齐到下一字节
    const group: MAFGroup = {
      key: crypto.randomUUID(),
      operator: Boolean(reader.readBit(1, 1, 'fill')),
      opposite: Boolean(reader.readBit(2, 2, 'blank')),
      children: [],
    }
    const childrenCount = reader.readBit(3, 8, 'blank')
    reader.moveBy(1)

    for (let i = 0; i < childrenCount; i++) {
      // 读取 Children 的 meta 字节（bit 1-2：operator + opposite，bit 3-8：id 高位）
      const child: MAFItem = {
        key: crypto.randomUUID(),
        operator: Boolean(reader.readBit(1, 1, 'fill')),
        opposite: Boolean(reader.readBit(2, 2, 'blank')),
        id: 0 as MAFModelId,
        value: {},
      }

      // id 共 14bit：高 6 位在 meta 字节 bit 3-8，低 8 位在下一字节 bit 1-8
      // readBit 只读不移动指针，读取后需手动 moveBy 对齐到下一字节
      // 高 6 位
      const idHigh = reader.readBit(3, 8, 'blank')
      reader.moveBy(1)
      // 低 8 位
      const idLow = reader.readBit(1, 8, 'blank')
      reader.moveBy(1)
      // 拼回完整 id
      child.id = ((idHigh << 8) | idLow) as MAFModelId

      // u32：value 字节长度；长度为 0 表示压缩端因溢出保护未写入数据（value 溢出 u32 范围），此时跳过读取
      const valueLength = Number(reader.readUint32LE('blank'))
      if (valueLength > 0) {
        const valueBytes = reader.readBytes(valueLength, 'blank')
        // 按 id 选择对应 packer 解码
        child.value = getValuePacker(child.id).decode(valueBytes, context)
      }

      group.children.push(child)
    }

    result.push(group)
  }

  return result
}

function unzip(data: Uint8Array, context: PresetPackContext): FilterConditions {
  if (data.length === 0) return new Map()

  const reader = new ByteReader(data)
  const head = Number(reader.readUint8('blank'))

  if (!isValidBinaryHead(head)) throw new Error('分享码头部无效')

  switch (getBinaryFilterType(head)) {
    case 'basic':
      return unzipBasic(reader, context)
    case 'advanced':
      return unzipAdvanced(reader, context)
    default:
      throw new Error('无效分享码：不支持的预设类型')
  }
}
