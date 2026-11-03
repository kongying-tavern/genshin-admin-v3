import type { MarkerItemLinkVo, MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaDummy,
  MAFOptionRange,
  MAFOptionSwitch,
  MAFSemanticUnit,
  MAFValueBoolean,
  MAFValueNumberRange,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'

type ValueType = MAFValueBoolean & MAFValueNumberRange
type OptionType = MAFOptionSwitch & MAFOptionRange

export class ItemCount implements MAFConfig<ValueType, OptionType, MAFMetaDummy> {
  id = MAFModelId.ITEM_COUNT
  name = MAF_MODEL_META_MAP[MAFModelId.ITEM_COUNT].name
  option: OptionType = {
    textActive: '所有',
    textInactive: '任意',
    placeholderMin: '不限',
    placeholderMax: '不限',
  }

  get defaultVal(): ValueType {
    return {
      b: false,
      nMin: null,
      nMax: null,
    }
  }

  prepare(_val: ValueType, _opt: OptionType): MAFMetaDummy {
    return {}
  }

  semantic(
    val: ValueType,
    opt: OptionType,
    _meta: MAFMetaDummy,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'highlight', text: val.b ? opt.textActive : opt.textInactive },
      { type: 'text', text: '物品计数' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      val.b ? { type: 'text', text: '均' } : null,
      { type: 'text', text: '为' },
      { type: 'highlight', text: `${val.nMin ?? '不限'} ~ ${val.nMax ?? '不限'}` },
    ]
  }

  filter(val: ValueType, _opt: OptionType, _meta: MAFMetaDummy, marker: MarkerVo): boolean {
    const minVal: number =
      val.nMin === undefined || val.nMin === null ? Number.NEGATIVE_INFINITY : val.nMin
    const maxVal: number =
      val.nMax === undefined || val.nMax === null ? Number.POSITIVE_INFINITY : val.nMax
    const itemList = marker.itemList ?? []
    const isMatch = (item: MarkerItemLinkVo): boolean =>
      item.count! >= minVal && item.count! <= maxVal
    return val.b ? itemList.every(isMatch) : itemList.some(isMatch)
  }
}
