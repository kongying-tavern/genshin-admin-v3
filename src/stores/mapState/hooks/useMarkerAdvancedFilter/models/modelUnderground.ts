import type { MarkerExtraVo, MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaUnderground,
  MAFOptionSelect,
  MAFSemanticUnit,
  MAFValueNumberExact,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'

enum OptionValue {
  UNLAYERED = 0,
  LAYERED = 1,
  LAYERED_GLOBAL = 2,
}

type OptionType = MAFOptionSelect<{ label: string; value: number }>

export class Underground implements MAFConfig<MAFValueNumberExact, OptionType, MAFMetaUnderground> {
  id = MAFModelId.UNDERGROUND
  name = MAF_MODEL_META_MAP[MAFModelId.UNDERGROUND].name
  option: OptionType = {
    options: [
      { label: '非分层', value: OptionValue.UNLAYERED },
      { label: '分层', value: OptionValue.LAYERED },
      { label: '无层级', value: OptionValue.LAYERED_GLOBAL },
    ],
    optionLabel: 'label',
    optionValue: 'value',
  }

  get defaultVal(): MAFValueNumberExact {
    return {
      nx: 0,
    }
  }

  prepare(val: MAFValueNumberExact, opt: OptionType): MAFMetaUnderground {
    const meta: MAFMetaUnderground = {
      tag: '',
    }

    // 查找选项
    meta.tag = opt.options.find(option => option.value === val.nx)?.label ?? ''

    return meta
  }

  semantic(
    _val: MAFValueNumberExact,
    _opt: OptionType,
    meta: MAFMetaUnderground,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'text', text: '点位' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      { type: 'text', text: '为' },
      { type: 'tag', text: meta.tag },
      { type: 'text', text: '点位' },
    ]
  }

  filter(
    val: MAFValueNumberExact,
    _opt: OptionType,
    _meta: MAFMetaUnderground,
    marker: MarkerVo,
  ): boolean {
    const underground = (marker.extra?.underground ?? {}) as MarkerExtraVo['underground']
    switch (val.nx) {
      case OptionValue.UNLAYERED:
        return !underground?.is_underground
      case OptionValue.LAYERED:
        return Boolean(underground?.is_underground) && !underground?.is_global
      case OptionValue.LAYERED_GLOBAL:
        return Boolean(underground?.is_underground) && Boolean(underground?.is_global)
    }
    return false
  }
}
