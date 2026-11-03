import type { RListItemVo } from '@/api/alova/globals'
import type { FetchHookOptions } from '@/hooks'
import { useItemStore } from '@/stores'

interface ItemListHookOption extends Omit<FetchHookOptions<RListItemVo>, 'immediate'> {
  params?: () => {
    typeIdList?: number[]
    areaIdList?: number[]
  }
}

/** 拉取物品id */
export const useItemList = (options: ItemListHookOption = {}) => {
  const { params } = options

  const itemStore = useItemStore()

  const fetchParams = computed(() => params?.() ?? {})

  const itemList = computed(() => {
    const { areaIdList = [], typeIdList = [] } = fetchParams.value
    let result = itemStore.itemList

    if (areaIdList.length) {
      const areaIdSet = new Set(areaIdList)
      result = result.filter(({ areaId = -1 }) => areaIdSet.has(areaId))
    }

    if (typeIdList.length) {
      const typeIdSet = new Set(typeIdList)
      result = result.filter(
        ({ typeIdList = [] }) => new Set(typeIdList).intersection(typeIdSet).size > 0,
      )
    }
    return result
  })

  const itemOptions = computed(() =>
    itemList.value.map(itemvo => ({
      label: `${itemvo.name} (id: ${itemvo.id})`,
      value: itemvo.id,
    })),
  )

  return { itemList, itemOptions }
}
