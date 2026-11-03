import type { MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaLinkageAction,
  MAFOptionSelect,
  MAFSemanticUnit,
  MAFValueStringArray,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'
import { LINK_ACTION_NAME_MAP, LINK_ACTION_OPTIONS, LinkActionEnum } from '@/shared/linkAction'
import { useMarkerLinkStore } from '@/stores'

type OptionType = (typeof LINK_ACTION_OPTIONS)[0]

export class LinkageAction implements MAFConfig<
  MAFValueStringArray,
  MAFOptionSelect<OptionType>,
  MAFMetaLinkageAction
> {
  id = MAFModelId.LINKAGE_ACTION
  name = MAF_MODEL_META_MAP[MAFModelId.LINKAGE_ACTION].name
  option: MAFOptionSelect<OptionType> = {
    dialogTitle: '选择关联类型',
    dialogListClass: 'grid grid-cols-2',
    options: LINK_ACTION_OPTIONS,
    optionSelectMultiple: true,
    optionLabel: 'label',
    optionValue: 'value',
  }

  get defaultVal(): MAFValueStringArray {
    return {
      sa: [],
    }
  }

  prepare(val: MAFValueStringArray, _opt: MAFOptionSelect<OptionType>): MAFMetaLinkageAction {
    const meta: MAFMetaLinkageAction = {
      linkActionMap: new Map<string, Set<string>>(),
      tagList: [],
      tag: '',
    }

    // 处理点位关联
    const { markerLinkList } = useMarkerLinkStore()
    markerLinkList.forEach(markerLink => {
      const { groupId = '', linkAction } = markerLink
      if (groupId && !meta.linkActionMap.has(groupId))
        meta.linkActionMap.set(groupId, new Set<string>())
      if (linkAction) meta.linkActionMap.get(groupId)?.add(linkAction)
    })

    // 处理标签名
    meta.tagList = val.sa
      .map(v => {
        const k = v as keyof typeof LinkActionEnum
        const e = LinkActionEnum[k]
        return LINK_ACTION_NAME_MAP.get(e) ?? ''
      })
      .filter(v => v)
    meta.tag = meta.tagList.join(',')

    return meta
  }

  semantic(
    _val: MAFValueStringArray,
    _opt: MAFOptionSelect<OptionType>,
    meta: MAFMetaLinkageAction,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'text', text: '点位关联' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      { type: 'text', text: '包含' },
      ...meta.tagList.map(tag => ({ type: 'tag', text: tag }) as const),
    ]
  }

  filter(
    val: MAFValueStringArray,
    _opt: MAFOptionSelect<OptionType>,
    meta: MAFMetaLinkageAction,
    marker: MarkerVo,
  ): boolean {
    if (marker.linkageId && meta.linkActionMap.has(marker.linkageId)) {
      const linkActions: Set<string> = meta.linkActionMap.get(marker.linkageId)!
      for (const action of val.sa) {
        if (linkActions.has(action)) return true
      }
    }
    return false
  }
}
