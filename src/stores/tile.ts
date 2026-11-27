import type { AreaTileConfig } from './systemConfigTiles'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { areaTags, groupAreaTags } from '@/configs'
import { toMapCoordinate } from '@/packages/map/src/utils/mapCoordinates'
import { useAccessStore, useArchiveStore, useAreaStore, useDadianStore } from '@/stores'
import { resolveSystemConfigTiles } from './systemConfigTiles'

export type { AreaTileConfig, TileInfo } from './systemConfigTiles'

/** 底图 */
export const useTileStore = defineStore('global-map-tile', () => {
  const areaStore = useAreaStore()
  const accessStore = useAccessStore()
  const dadianStore = useDadianStore()
  const archiveStore = useArchiveStore()

  const areaCode = computed(() => {
    return archiveStore.preference['markerFilter.state.areaCode']
  })

  const resolvedTileConfigs = computed(() =>
    resolveSystemConfigTiles(dadianStore.raw, accessStore.hasBeta),
  )

  /**
   * @key 表示地区 code
   * @value 表示 tile 的相关配置
   */
  const codeMap = computed(
    () =>
      new Map(
        Array.from(resolvedTileConfigs.value, ([code, { config }]) => [code, config] as const),
      ),
  )

  /** @deprecated 用 `codeMap` 代替 */
  const mergedTileConfigs = computed(() => Object.fromEntries(codeMap.value))

  /** 当前激活的底图配置 */
  const currentTileConfig = computed(() => {
    if (!areaCode.value) return
    return codeMap.value.get(areaCode.value)
  })

  /** 当前激活的底图code */
  const currentTileCode = computed(() => {
    if (!currentTileConfig.value) return
    return currentTileConfig.value.tile.code
  })

  /** 当前底图中可见的地区 */
  const visibleArea = computed(() => {
    const areaCodeSet = new Set<string>()
    const tileConfigs = mergedTileConfigs.value
    for (const areaCode in tileConfigs) {
      const { tile } = tileConfigs[areaCode]
      if (tile.code !== currentTileCode.value) continue
      areaCodeSet.add(areaCode)
    }

    const areaIdSet = new Set<number>()
    const { areaCodeMap } = areaStore
    areaCodeSet.forEach(areaCode => {
      const area = areaCodeMap.get(areaCode)
      if (!area) return
      areaIdSet.add(area.id!)
    })

    return {
      codes: areaCodeSet,
      ids: areaIdSet,
    }
  })

  /** 当前底图中可见的标签 */
  const visibleTagGroups = computed(() =>
    groupAreaTags([...visibleArea.value.codes].flatMap(code => areaTags.value[code] ?? [])),
  )

  /** 地图贴片选项 */
  const mapTileOptions = computed(() => {
    const { areaCodeMap } = areaStore
    const tileOptions: Record<string, AreaTileConfig> = {}
    for (const areaCode in mergedTileConfigs.value) {
      if (!areaCodeMap.has(areaCode)) continue

      const tileConfig = mergedTileConfigs.value[areaCode]
      const tileName = tileConfig.tile.name
      const tileCode = tileConfig.tile.code
      if (!tileName) continue
      else if (tileOptions[tileCode]) continue

      const { tile, initViewState } = tileConfig
      tileOptions[tileCode] = { code: areaCode, tile, initViewState }
    }
    return Object.entries(tileOptions).map(([_, v]) => v)
  })

  /** 将地图坐标转换为点位坐标 */
  const toMarkerCoordinate = ([x, y]: DTO.Coordinate2D): DTO.Coordinate2D => {
    if (!currentTileConfig.value) return [x, y]
    const {
      center: [ox, oy],
    } = currentTileConfig.value.tile
    return [x - ox, y - oy]
  }

  /** 将点位坐标转换为地图坐标 */
  const convertToMapCoordinate = (coordinate: DTO.Coordinate2D): DTO.Coordinate2D => {
    const origin = currentTileConfig.value?.tile.center
    return origin ? toMapCoordinate(coordinate, origin) : [...coordinate]
  }

  return {
    resolvedTileConfigs,
    codeMap,
    mergedTileConfigs,
    currentTileConfig,
    currentTileCode,
    visibleTagGroups,
    visibleArea,
    mapTileOptions,

    toMarkerCoordinate,
    toMapCoordinate: convertToMapCoordinate,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTileStore, import.meta.hot))
}
