import type { MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaContentRegex,
  MAFOptionInput,
  MAFSemanticUnit,
  MAFValueString,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'

export class ContentRegex implements MAFConfig<
  MAFValueString,
  MAFOptionInput,
  MAFMetaContentRegex
> {
  id = MAFModelId.CONTENT_REGEX
  name = MAF_MODEL_META_MAP[MAFModelId.CONTENT_REGEX].name
  option: MAFOptionInput = {
    placeholder: '',
  }

  get defaultVal(): MAFValueString {
    return {
      s: '',
    }
  }

  prepare(val: MAFValueString, _opt: MAFOptionInput): MAFMetaContentRegex {
    const meta: MAFMetaContentRegex = {
      re: undefined,
    }

    // 处理正则表达式
    if (val.s) {
      try {
        meta.re = new RegExp(val.s, 'iu')
      } catch {
        meta.re = null
      }
    }

    return meta
  }

  semantic(
    val: MAFValueString,
    _opt: MAFOptionInput,
    meta: MAFMetaContentRegex,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'text', text: '内容' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      { type: 'text', text: '满足正则' },
      meta.re === null ? { type: 'error', text: '正则错误' } : { type: 'regex', text: val.s },
    ]
  }

  filter(
    _val: MAFValueString,
    _opt: MAFOptionInput,
    meta: MAFMetaContentRegex,
    marker: MarkerVo,
  ): boolean {
    if (!meta.re) return false
    return meta.re.test(marker.content ?? '')
  }
}
