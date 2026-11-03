import { storeToRefs } from 'pinia'
import { useMapStateStore, usePreferenceStore } from '@/stores'

export const useMarkerFilter = () => {
  const preferenceStore = usePreferenceStore()
  const { markerBasicFilters } = storeToRefs(useMapStateStore())

  const reviewCondition = (id: string) => {
    const condition = markerBasicFilters.value.get(id)
    if (!condition) return
    const { area, type } = condition
    preferenceStore.areaCode = area.code!
    preferenceStore.itemTypeId = type.id!
    preferenceStore.step = 2
  }

  const deleteCondition = (id: string) => {
    const condition = markerBasicFilters.value.get(id)
    if (!condition) return
    const existItemIds = new Set(preferenceStore.itemIds)
    const { items } = condition
    items.forEach(itemId => existItemIds.delete(itemId))
    preferenceStore.itemIds = [...existItemIds]
  }

  const clearCondition = () => {
    preferenceStore.itemIds = []
  }

  return {
    reviewCondition,
    deleteCondition,
    clearCondition,
  }
}
