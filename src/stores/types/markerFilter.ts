import type { MaybeComputedRef } from '@vueuse/core'
import type { AreaVo, ItemTypeVo, MarkerVo } from '@/api/alova/globals'
import type { MAFModelId } from '@/shared'

// ==================== 基础筛选模型 ====================
interface PresetType {
  basic: Record<string, MBFItem>
  advanced: MAFGroup[]
}

export type FilterType = keyof PresetType

export interface ExtractFilter<K extends FilterType> {
  name: string
  type: K
  conditions: PresetType[K]
}

export type FilterPreset = ExtractFilter<'basic'> | ExtractFilter<'advanced'>

export interface MBFItem {
  area: AreaVo
  type: ItemTypeVo
  items: number[]
}

// ==================== 高级筛选模型 ====================
export interface MAFGroup {
  key: string
  // true 为 AND，false 为 OR
  operator: boolean
  opposite: boolean
  children: MAFItem[]
}

export interface MAFItem {
  key: string
  id: MAFModelId
  // true 为 AND，false 为 OR
  operator: boolean
  opposite: boolean
  value: MAFValue
}

export interface MAFGroupComposed {
  key: string
  operator: boolean
  opposite: boolean
  children: MAFItemComposed[]
}

export interface MAFItemComposed<
  V extends MAFValue = MAFValue,
  O extends MAFOption = MAFOption,
  M extends MAFMeta = MAFMeta,
> {
  key: string
  id: MAFModelId
  operator: boolean
  opposite: boolean
  value: V
  option: MaybeComputedRef<O>
  meta: M
  semantic?: (val: V, opt: O, meta: M, opposite: boolean) => (MAFSemanticUnit | null)[]
  filter?: (val: V, opt: O, meta: M, marker: MarkerVo) => boolean
}

export type MAFSemanticType =
  | 'logic-operator'
  | 'opposite-indicator'
  | 'parenthesis'
  | 'error'
  | 'regex'
  | 'tag'
  | 'highlight'
  | 'text'
  | 'number'

export interface MAFSemanticUnit {
  type: MAFSemanticType
  text?: string
}

export interface MAFConfig<
  V extends MAFValue = MAFValue,
  O extends MAFOption = MAFOption,
  M extends MAFMeta = MAFMeta,
> {
  readonly id: MAFModelId
  readonly name: string
  readonly option: MaybeComputedRef<O>
  readonly defaultVal: V
  prepare: (val: V, opt: O) => M
  semantic: (val: V, opt: O, meta: M, opposite: boolean) => (MAFSemanticUnit | null)[]
  filter: (val: V, opt: O, meta: M, marker: MarkerVo) => boolean
}

// ==================== 数据模型 ====================
export type MAFValue = Record<string, unknown>

export interface MAFValueDummy extends MAFValue {
  [key: string]: never
}

export interface MAFValueString extends MAFValue {
  s: string
}

export interface MAFValueStringArray extends MAFValue {
  sa: string[]
}

export interface MAFValueNumber extends MAFValue {
  n: number | null
}

export interface MAFValueNumberExact extends MAFValue {
  nx: number
}

export interface MAFValueNumberArray extends MAFValue {
  na: number[]
}

export interface MAFValueNumberRange extends MAFValue {
  nMin: number | null
  nMax: number | null
}

export interface MAFValueBoolean extends MAFValue {
  b: boolean
}

// ==================== 配置模型 ====================
export type MAFOption = Record<string, unknown>

export interface MAFOptionDummy extends MAFOption {
  [key: string]: never
}

export interface MAFOptionInput extends MAFOption {
  placeholder?: string
}

export interface MAFOptionSelect<T> extends MAFOption {
  dialogTitle?: string
  dialogListClass?: string
  options: T[]
  optionSelectMultiple?: boolean
  optionLabel: string
  optionValue: string
}

export interface MAFOptionRange extends MAFOption {
  placeholderMin?: string
  placeholderMax?: string
  startMin?: number
  startMinIncluded?: boolean
  startMax?: number
  startMaxIncluded?: boolean
  endMin?: number
  endMinIncluded?: boolean
  endMax?: number
  endMaxIncluded?: boolean
}

export interface MAFOptionSwitch extends MAFOption {
  textInactive?: string
  textActive?: string
}

// ==================== 预处理数据模型 ====================
export type MAFMeta = Record<string, unknown>

export interface MAFMetaDummy extends MAFMeta {
  [key: string]: never
}

export interface MAFMetaIdRange extends MAFMeta {
  idRange: ([number, number] | number)[]
  idSet: Set<number>
}

export interface MAFMetaContentRegex extends MAFMeta {
  /** 解析过的正则表达式，null 表示解析失败，undefined 表示空 */
  re?: RegExp | null
}

export interface MAFMetaUnderground extends MAFMeta {
  tag: string
}

export interface MAFMetaUndergroundLayer extends MAFMeta {
  layerKeyMap: Record<
    string,
    {
      areaId: number
      areaName: string
      groupKey: string
      groupName: string
    }[]
  >
  layerNameMap: Record<string, string>
  tagList: string[]
  tag: string
}

export interface MAFMetaLinkageAction extends MAFMeta {
  linkActionMap: Map<string, Set<string>>
  tagList: string[]
  tag: string
}

export interface MAFMetaRefreshTime extends MAFMeta {
  isCustom: boolean
  tagNameMap: Record<number, string>
}

export interface MAFMetaVisibility extends MAFMeta {
  tagList: string[]
  tag: string
}

export interface MAFMetaArea extends MAFMeta {
  tagList: string[]
  tag: string
  areaParentIdMap: Record<number, number>
  itemIds: Set<number>
}

export interface MAFMetaItemType extends MAFMeta {
  tagList: string[]
  tag: string
  itemIds: Set<number>
}

export interface MAFMetaItemName extends MAFMeta {
  tagList: string[]
  itemIds: Set<number>
}

export interface MAFMetaItemNameRegex extends MAFMeta {
  /** 解析过的正则表达式，null 表示解析失败，undefined 表示空 */
  re?: RegExp | null
  itemIds: Set<number>
}
