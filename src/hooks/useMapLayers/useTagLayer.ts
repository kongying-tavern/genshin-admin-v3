import type { GSTagLayerProps } from '@/packages/map'
import { GSTagLayer } from '@/packages/map'
import { useDadianStore, usePreferenceStore, useTileStore } from '@/stores'

export const useTagLayer = (options?: () => GSTagLayerProps) => {
  const dadianStore = useDadianStore()
  const tileStore = useTileStore()
  const preferenceStore = usePreferenceStore()

  const tagLayer = computed(() => {
    const tile = tileStore.currentTileConfig?.tile
    if (!tile) return
    return new GSTagLayer({
      ...(options?.() ?? {
        visible: preferenceStore.showZoneTag,
        tagGroups: tileStore.visibleTagGroups,
      }),
      offset: tile.center,
      fontFamily: dadianStore.fontFamilySet.has('HYWenHei-85W')
        ? 'HYWenHei-85W, Monaco, monospace'
        : undefined,
    })
  })

  return {
    tagLayer,
  }
}
