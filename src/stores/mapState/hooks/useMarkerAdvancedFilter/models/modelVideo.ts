import type { MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaDummy,
  MAFOptionSwitch,
  MAFSemanticUnit,
  MAFValueBoolean,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'

export class Video implements MAFConfig<MAFValueBoolean, MAFOptionSwitch, MAFMetaDummy> {
  id = MAFModelId.VIDEO
  name = MAF_MODEL_META_MAP[MAFModelId.VIDEO].name
  option: MAFOptionSwitch = {
    textInactive: '不存在',
    textActive: '存在',
  }

  get defaultVal(): MAFValueBoolean {
    return {
      b: false,
    }
  }

  prepare(_val: MAFValueBoolean, _opt: MAFOptionSwitch): MAFMetaDummy {
    return {}
  }

  semantic(
    val: MAFValueBoolean,
    opt: MAFOptionSwitch,
    _meta: MAFMetaDummy,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'text', text: '点位视频' },
      { type: 'tag', text: val.b === opposite ? opt.textInactive : opt.textActive },
    ]
  }

  filter(
    val: MAFValueBoolean,
    _opt: MAFOptionSwitch,
    _meta: MAFMetaDummy,
    marker: MarkerVo,
  ): boolean {
    return val.b ? !!marker.videoPath : !marker.videoPath
  }
}
