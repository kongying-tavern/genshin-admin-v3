import type { FilterConditions, FilterConditionsAdvanced, FilterConditionsBasic } from '../types'
import type { FilterType, MBFItem } from '@/stores/types'

export function isBaseFilter(conditions: FilterConditions): conditions is FilterConditionsBasic {
  return !Array.isArray(conditions)
}

export function isAdvancedFilter(
  conditions: FilterConditions,
): conditions is FilterConditionsAdvanced {
  return Array.isArray(conditions)
}

export function toConditionsBaseMap(conditions: FilterConditionsBasic): Map<string, MBFItem> {
  return conditions instanceof Map ? conditions : new Map(Object.entries(conditions))
}

export function toConditionsBaseRecord(conditions: FilterConditionsBasic): Record<string, MBFItem> {
  return conditions instanceof Map ? Object.fromEntries(conditions) : conditions
}

/** 二进制头部预检：前两位为 0b01 表示合法压缩数据的标记 */
export function isValidBinaryHead(head: number): boolean {
  return (head & 0b11000000) === 0b01000000
}

/** 根据二进制头部后四位判断二进制对应的过滤类型 */
export function getBinaryFilterType(head: number): FilterType | '' {
  switch (head & 0b1111) {
    case 0b0001:
      return 'basic'
    case 0b0010:
      return 'advanced'
    default:
      return ''
  }
}
