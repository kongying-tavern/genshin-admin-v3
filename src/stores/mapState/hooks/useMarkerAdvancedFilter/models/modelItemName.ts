import type { MarkerVo } from '@/api/alova/globals'
import type {
  MAFConfig,
  MAFMetaItemName,
  MAFOptionInput,
  MAFSemanticUnit,
  MAFValueString,
} from '@/stores/types'
import { MAF_MODEL_META_MAP, MAFModelId } from '@/shared'
import { useItemStore } from '@/stores'

export class ItemName implements MAFConfig<MAFValueString, MAFOptionInput, MAFMetaItemName> {
  id = MAFModelId.ITEM_NAME
  name = MAF_MODEL_META_MAP[MAFModelId.ITEM_NAME].name
  option: MAFOptionInput = {
    placeholder: '格式：A,B,C',
  }

  get defaultVal(): MAFValueString {
    return {
      s: '',
    }
  }

  prepare(val: MAFValueString, _opt: MAFOptionInput): MAFMetaItemName {
    const meta: MAFMetaItemName = {
      tagList: [],
      itemIds: new Set<number>(),
    }

    // 处理物品标签名
    meta.tagList = val.s.split(',').filter(v => v)

    // 处理物品ID
    if (val.s) {
      const { itemList } = useItemStore()
      const itemNames = val.s.split(',').filter(v => v)
      const itemNameSet = new Set(itemNames)
      const itemIdList: number[] = itemList
        .filter(item => itemNameSet.has(item.name!))
        .map(item => item.id!)
        .filter(v => v)
      meta.itemIds = new Set(itemIdList)
    }

    return meta
  }

  semantic(
    _val: MAFValueString,
    _opt: MAFOptionInput,
    meta: MAFMetaItemName,
    opposite: boolean,
  ): (MAFSemanticUnit | null)[] {
    return [
      { type: 'text', text: '物品名' },
      opposite ? { type: 'opposite-indicator', text: '不' } : null,
      { type: 'text', text: '为' },
      ...meta.tagList.map(tag => ({ type: 'tag', text: tag }) as const),
    ]
  }

  filter(
    _val: MAFValueString,
    _opt: MAFOptionInput,
    meta: MAFMetaItemName,
    marker: MarkerVo,
  ): boolean {
    const itemIds: number[] = (marker.itemList ?? []).map(item => item.itemId!).filter(v => v)
    for (const itemId of itemIds) {
      if (meta.itemIds.has(itemId)) return true
    }
    return false
  }
}
