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
    const font = dadianStore.loadedFontFamilies.get(preferenceStore.mapLabelFont)
    return new GSTagLayer({
      ...(options?.() ?? {
        visible: preferenceStore.showZoneTag,
        tagGroups: tileStore.visibleTagGroups,
      }),
      offset: tile.center,
      fontFamily: font ? `${font}, Monaco, monospace` : 'Monaco, monospace',
    })
  })

  return {
    tagLayer,
  }
}
