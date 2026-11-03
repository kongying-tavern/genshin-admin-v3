import type { useArchiveStore, useAreaStore, useItemStore, useItemTypeStore } from '@/stores'
import type { MBFItem } from '@/stores/types'
import { storeToRefs } from 'pinia'

interface MarkerBasicFilterHookOptions {
  archiveStore: ReturnType<typeof useArchiveStore>
  areaStore: ReturnType<typeof useAreaStore>
  itemTypeStore: ReturnType<typeof useItemTypeStore>
  itemStore: ReturnType<typeof useItemStore>
}

let cache: ReturnType<typeof _useMarkerBasicFilter>

const _useMarkerBasicFilter = (options: MarkerBasicFilterHookOptions) => {
  const { archiveStore, areaStore, itemTypeStore, itemStore } = options

  const { areaIdMap } = storeToRefs(areaStore)
  const { itemTypeIdMap } = storeToRefs(itemTypeStore)
  const { itemIdMap } = storeToRefs(itemStore)

  const archiveItemIds = computed(() => {
    return archiveStore.currentArchive.body.Preference['markerFilter.state.itemIds'] ?? []
  })

  const conditions = computed(() => {
    const itemMap = itemIdMap.value
    const areaMap = areaIdMap.value
    const typeMap = itemTypeIdMap.value
    return archiveItemIds.value.reduce((map, itemId) => {
      const item = itemMap.get(itemId)
      if (!item) return map
      const area = areaMap.get(item.areaId!)
      if (!area) return map
      item.typeIdList?.forEach(itemTypeId => {
        const type = typeMap.get(itemTypeId!)
        if (!type) return
        const id = `${area.code!}-${itemTypeId}`
        const existCondition = map.get(id)
        if (!existCondition) {
          map.set(id, {
            area,
            type,
            items: [itemId],
          })
          return
        }
        existCondition.items.push(itemId)
      })
      return map
    }, new Map<string, MBFItem>())
  })

  return {
    markerBasicFilters: conditions,
  }
}

export const useMarkerBasicFilter = (options: MarkerBasicFilterHookOptions) => {
  if (!cache) cache = _useMarkerBasicFilter(options)
  return cache
}
