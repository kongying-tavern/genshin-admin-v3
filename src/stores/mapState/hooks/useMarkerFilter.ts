import type { useArchiveStore, useAreaStore, useItemStore, useItemTypeStore } from '@/stores'
import type { MAFGroup, MBFItem } from '@/stores/types'
import { useMarkerAdvancedFilter, useMarkerBasicFilter } from '.'

interface MarkerFilterHookOptions {
  archiveStore: ReturnType<typeof useArchiveStore>
  areaStore: ReturnType<typeof useAreaStore>
  itemTypeStore: ReturnType<typeof useItemTypeStore>
  itemStore: ReturnType<typeof useItemStore>
}

export const useMarkerFilter = (options: MarkerFilterHookOptions) => {
  const { archiveStore } = options

  const { markerBasicFilters } = useMarkerBasicFilter(options)
  const { markerAdvancedFilters } = useMarkerAdvancedFilter(options)

  const markerFilterType = computed(() => {
    const type =
      archiveStore.currentArchive.body.Preference['markerFilter.setting.filterType'] ?? 'basic'
    return ['basic', 'advanced'].includes(type) ? type : 'basic'
  })

  const markerFilters = computed(() => {
    switch (markerFilterType.value) {
      case 'advanced':
        return markerAdvancedFilters.value
      case 'basic':
      default:
        return markerBasicFilters.value
    }
  })

  const markerFilterSize = computed(() => {
    switch (markerFilterType.value) {
      case 'advanced':
        return (markerFilters.value as MAFGroup[]).length
      case 'basic':
      default:
        return (markerFilters.value as Map<string, MBFItem>).size
    }
  })

  return {
    markerFilterType,
    markerFilters,
    markerFilterSize,
  }
}
