import type { MarkerVo } from '@/api/alova/globals'
import type { AreaWithChildren } from '@/stores'
import type {
  MAFConfig,
  MAFMetaArea,
  MAFOptionSelect,
  MAFSemanticUnit,
  MAFValueNumberArray,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'
import { useAreaStore, useItemStore } from '@/stores'

type OptionType = MAFOptionSelect<AreaWithChildren>

export class Area implements MAFConfig<MAFValueNumberArray, OptionType, MAFMetaArea> {
  id = MAFModelId.AREA
  name = MAF_MODEL_META_MAP[MAFModelId.AREA].name
  option: ComputedRef<OptionType> = computed(() => {
    const { areaTree } = useAreaStore()

    return {
      dialogTitle: '选择地区',
      options: areaTree,
      optionLabel: 'name',
      optionValue: 'id',
      optionSelectMultiple: true,
    }
  })

  get defaultVal(): MAFValueNumberArray {
    return {
      na: [],
    }
  }

  prepare(val: MAFValueNumberArray, _opt: OptionType): MAFMetaArea {
    const meta: MAFMetaArea = {
      tagList: [],
      tag: '',
      areaParentIdMap: {},
      itemIds: new Set<number>(),
    }

    const { areaIdMap, childrenAreaList } = useAreaStore()
    // 处理标签名
    meta.tagList = val.na.map(areaId => (areaIdMap.get(areaId) ?? {}).name!).filter(v => v)
    meta.tag = meta.tagList.join(',')

    // 处理地区父ID映射
    meta.areaParentIdMap = Object.fromEntries(
      childrenAreaList.map(({ id: childId = 0, parentId = -1 }) => [childId, parentId]),
    )

    // 处理物品ID
    if (val.na && val.na.length > 0) {
      const { itemList } = useItemStore()
      const itemIdList: number[] = itemList
        .filter(item => val.na.includes(item.areaId!))
        .map(item => item.id!)
        .filter(v => v)
      meta.itemIds = new Set(itemIdList)
    }

    return meta
  }

  semantic(
    _val: MAFValueNumberArray,
    _opt: OptionType,
    meta: MAFMetaArea,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'text', text: '地区' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      { type: 'text', text: '为' },
      ...meta.tagList.map<MAFSemanticUnit>(tag => ({ type: 'tag', text: tag })),
    ]
  }

  filter(
    _val: MAFValueNumberArray,
    _opt: OptionType,
    meta: MAFMetaArea,
    marker: MarkerVo,
  ): boolean {
    const itemIds: number[] = (marker.itemList ?? []).map(v => v.itemId!).filter(v => v)
    for (const itemId of itemIds) {
      if (meta.itemIds.has(itemId)) return true
    }
    return false
  }
}
