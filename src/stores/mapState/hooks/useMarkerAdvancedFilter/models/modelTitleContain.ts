import type { MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaDummy,
  MAFOptionInput,
  MAFSemanticUnit,
  MAFValueString,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'

export class TitleContain implements MAFConfig<MAFValueString, MAFOptionInput, MAFMetaDummy> {
  id = MAFModelId.TITLE_CONTAIN
  name = MAF_MODEL_META_MAP[MAFModelId.TITLE_CONTAIN].name
  option: MAFOptionInput = {
    placeholder: '',
  }

  get defaultVal(): MAFValueString {
    return {
      s: '',
    }
  }

  prepare(_val: MAFValueString, _opt: MAFOptionInput): MAFMetaDummy {
    return {}
  }

  semantic(
    val: MAFValueString,
    _opt: MAFOptionInput,
    _meta: MAFMetaDummy,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'text', text: '标题' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      { type: 'text', text: '包含' },
      { type: 'highlight', text: val.s },
    ]
  }

  filter(
    val: MAFValueString,
    _opt: MAFOptionInput,
    _meta: MAFMetaDummy,
    marker: MarkerVo,
  ): boolean {
    if (!val.s) return false
    return (marker.markerTitle ?? '').includes(val.s)
  }
}
