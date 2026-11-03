import type { MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaDummy,
  MAFOptionRange,
  MAFSemanticUnit,
  MAFValueNumberRange,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'

export class ItemSize implements MAFConfig<MAFValueNumberRange, MAFOptionRange, MAFMetaDummy> {
  id = MAFModelId.ITEM_SIZE
  name = MAF_MODEL_META_MAP[MAFModelId.ITEM_SIZE].name
  option: MAFOptionRange = {
    placeholderMin: '不限',
    placeholderMax: '不限',
  }

  get defaultVal(): MAFValueNumberRange {
    return {
      nMin: null,
      nMax: null,
    }
  }

  prepare(_val: MAFValueNumberRange, _opt: MAFOptionRange): MAFMetaDummy {
    return {}
  }

  semantic(
    val: MAFValueNumberRange,
    _opt: MAFOptionRange,
    _meta: MAFMetaDummy,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'text', text: '物品条数' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      { type: 'text', text: '为' },
      { type: 'highlight', text: `${val.nMin ?? '不限'} ~ ${val.nMax ?? '不限'}` },
    ]
  }

  filter(
    val: MAFValueNumberRange,
    _opt: MAFOptionRange,
    _meta: MAFMetaDummy,
    marker: MarkerVo,
  ): boolean {
    const minVal: number =
      val.nMin === undefined || val.nMin === null ? Number.NEGATIVE_INFINITY : val.nMin
    const maxVal: number =
      val.nMax === undefined || val.nMax === null ? Number.POSITIVE_INFINITY : val.nMax
    const itemList = marker.itemList ?? []
    return itemList.length >= minVal && itemList.length <= maxVal
  }
}
