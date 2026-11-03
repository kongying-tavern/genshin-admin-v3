import type { ItemTypeVo, MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaItemType,
  MAFOptionSelect,
  MAFSemanticUnit,
  MAFValueNumberArray,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'
import { useItemStore, useItemTypeStore } from '@/stores'

type OptionType = MAFOptionSelect<ItemTypeVo>

export class ItemType implements MAFConfig<MAFValueNumberArray, OptionType, MAFMetaItemType> {
  id = MAFModelId.ITEM_TYPE
  name = MAF_MODEL_META_MAP[MAFModelId.ITEM_TYPE].name
  option: ComputedRef<OptionType> = computed(() => {
    const { itemTypeList } = useItemTypeStore()

    const typeList = itemTypeList.filter(itemType => itemType.isFinal)

    return {
      dialogTitle: '选择分类',
      dialogListClass: 'grid grid-cols-2',
      options: typeList,
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

  prepare(val: MAFValueNumberArray, _opt: OptionType): MAFMetaItemType {
    const meta: MAFMetaItemType = {
      tagList: [],
      tag: '',
      itemIds: new Set<number>(),
    }

    // 处理标签名
    const { itemTypeMap } = useItemTypeStore()
    meta.tagList = val.na.map(typeId => itemTypeMap[typeId]?.name).filter(v => v) as string[]
    meta.tag = meta.tagList.join(',')

    // 处理物品ID
    if (val.na && val.na.length > 0) {
      const { itemList } = useItemStore()
      const itemIdList: number[] = itemList.reduce<number[]>((seed, item) => {
        const typeIds = item.typeIdList ?? []
        for (const typeId of typeIds) {
          if (val.na.includes(typeId)) return [...seed, item.id!]
        }
        return seed
      }, [])
      meta.itemIds = new Set(itemIdList)
    }

    return meta
  }

  semantic(
    _val: MAFValueNumberArray,
    _opt: OptionType,
    meta: MAFMetaItemType,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'text', text: '类别' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      { type: 'text', text: '为' },
      ...meta.tagList.map<MAFSemanticUnit>(tag => ({ type: 'tag', text: tag })),
    ]
  }

  filter(
    _val: MAFValueNumberArray,
    _opt: OptionType,
    meta: MAFMetaItemType,
    marker: MarkerVo,
  ): boolean {
    const itemIds: number[] = (marker.itemList ?? []).map(v => v.itemId!).filter(v => v)
    for (const itemId of itemIds) {
      if (meta.itemIds.has(itemId)) return true
    }
    return false
  }
}
