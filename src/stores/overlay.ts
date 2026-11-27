import type { OverlayChunk } from '@/packages/map'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useAccessStore, useArchiveStore, useDadianStore, useTileStore } from '.'
import { resolveOverlayConfig } from './systemConfigLayers'

/** 地图附加图层 */
export const useOverlayStore = defineStore('global-map-overlays', () => {
  const tileStore = useTileStore()
  const accessStore = useAccessStore()
  const archiveStore = useArchiveStore()
  const dadianStore = useDadianStore()

  /** 当前激活的 overlay 单元（激活状态并不代表显示状态） */
  const activedItemIds = ref(new Set<string>())

  /** 切换 overlay item 的激活状态，并维护操作顺序 */
  const toggleItem = (itemId: string, visible: boolean) => {
    const newSet = new Set(activedItemIds.value)
    if (visible) {
      newSet.delete(itemId)
      newSet.add(itemId)
    } else {
      newSet.delete(itemId)
    }
    activedItemIds.value = newSet
  }

  const showOverlay = computed(() => {
    return archiveStore.preference['map.state.showOverlay']
  })

  const resolved = computed(() =>
    resolveOverlayConfig(dadianStore.raw, accessStore.hasBeta, tileStore.mergedTileConfigs),
  )
  const normalizedOverlayChunks = computed(() => resolved.value.chunks)
  const enabledAreas = computed(() => resolved.value.enabledAreas)
  const groupsByArea = computed(() => resolved.value.groupsByArea)

  // 初始化地图类型附加图层
  watch(
    normalizedOverlayChunks,
    chunks => {
      const selectedItemInGroup = new Map<string, string>()
      chunks.forEach(chunk => {
        const { role, id: groupId } = chunk.group
        const { id: itemId } = chunk.item
        // 底图图层在每组内只能为单选
        if (role !== 'tile' || selectedItemInGroup.has(groupId)) return
        selectedItemInGroup.set(groupId, itemId)
      })
      const itemIdSet = new Set<string>()
      selectedItemInGroup.forEach(itemId => {
        itemIdSet.add(itemId)
      })
      activedItemIds.value = itemIdSet
    },
    { immediate: true },
  )

  const items = computed(() => {
    const itemGroups = Map.groupBy(normalizedOverlayChunks.value, chunk => chunk.item)
    return [...itemGroups.entries()].map(([item, chunks]) => {
      return {
        ...item,
        areaCodes: chunks[0].areaCodes,
        chunks,
      }
    })
  })

  /** chunk 索引表 */
  const chunkMap = computed(() =>
    normalizedOverlayChunks.value.reduce((map, chunk) => {
      map.set(chunk.id, chunk)
      return map
    }, new Map<string, OverlayChunk>()),
  )

  /** 当前激活的 overlay 单元（激活状态并不代表显示状态） */
  const activedItems = computed(() => items.value.filter(item => activedItemIds.value.has(item.id)))

  /** 只存在于当前图层内的 overlay */
  const existOverlays = computed((): OverlayChunk[] => {
    const { currentTileConfig } = tileStore
    if (!currentTileConfig) return []
    const { mergedTileConfigs } = tileStore
    const { code: currentLayerCode } = currentTileConfig.tile
    const hideDefaultOverlay = !showOverlay.value
    return normalizedOverlayChunks.value.filter(({ areaCodes, group }) => {
      if (hideDefaultOverlay && group.role === 'default') return false

      for (const areaCode of areaCodes) {
        const config = mergedTileConfigs[areaCode]
        if (!config) continue
        if (config.tile.code === currentLayerCode) return true
      }
      return false
    })
  })

  /** 只存在于当前图层内且可见的 chunks */
  const visibleChunks = computed(() => {
    const result = {
      default: [] as string[],
      tile: [] as string[],
    }
    // 按照 activedItemIds 的顺序遍历，确保最新激活的 item 的 chunks 在后方
    for (const itemId of activedItemIds.value) {
      for (const chunk of existOverlays.value) {
        if (chunk.item.id === itemId) {
          result[chunk.group.role].push(chunk.id)
        }
      }
    }
    return result
  })

  const isOverlaysHasMask = computed(() => {
    for (const chunk of existOverlays.value) {
      if (chunk.group.mask) return true
    }
    return false
  })

  const showMask = computed((): boolean => {
    if (!isOverlaysHasMask.value) return false
    return Boolean(
      existOverlays.value.find(chunk => {
        const { role } = chunk.group
        if (role === 'tile') return false
        return activedItemIds.value.has(chunk.item.id)
      }),
    )
  })

  return {
    // state
    activedItemIds,

    // actions
    toggleItem,

    // getters
    enabledAreas,
    groupsByArea,
    items,
    chunkMap,
    existOverlays,
    showMask,
    activedItems,
    visibleChunks,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOverlayStore, import.meta.hot))
}
