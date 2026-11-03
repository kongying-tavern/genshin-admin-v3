import type { AreaTagTuple } from '@/configs'
import { defaultsDeep, merge } from 'lodash'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { AREA_ADDITIONAL_CONFIG_MAP } from '@/configs'
import { useAccessStore, useArchiveStore, useAreaStore, useDadianStore } from '@/stores'

export interface TileInfo extends Required<
  Pick<DTO.TileConfig, 'code' | 'name' | 'extension' | 'tilesOffset' | 'size' | 'center'>
> {}

type AreaTagConfigs = Required<(typeof AREA_ADDITIONAL_CONFIG_MAP)[string]>['tags']

/**
 * 与地区对应的 tile 配置，为什么没有设计为与 layer code 对应而是与地区 code 对应，见以下原因：
 * 1. 首先是为了匹配筛选器的操作逻辑，即选择地区自动切换地图
 * 2. 其次，有利于为地区附加对应的 tag 或边界等数据
 * 3. 对于打点工具来说，关注地区信息比关注 tile 信息本身的时候会更多
 */
export interface AreaTileConfig {
  /** 地区 code，便于在列表中使用 */
  code?: string
  /** 地区关联的 tile 的信息，使用对象是为了方便复用 */
  tile: TileInfo
  /** 导航到该地区时的默认视口状态 */
  initViewState: {
    target: DTO.Coordinate2D
    zoom: number
  }
  /** 地区标签 */
  tags: AreaTagConfigs
}

/** 底图 */
export const useTileStore = defineStore('global-map-tile', () => {
  const areaStore = useAreaStore()
  const accessStore = useAccessStore()
  const dadianStore = useDadianStore()
  const archiveStore = useArchiveStore()

  const areaCode = computed(() => {
    return archiveStore.currentArchive.body.Preference['markerFilter.state.areaCode']
  })

  const mergedTiles = computed(() => {
    const { tiles = {}, tilesBeta = {} } = dadianStore.raw
    return accessStore.hasBeta ? merge(tiles, tilesBeta) : tiles
  })

  /**
   * key 是用于构建 tiles url 的参数
   * @deprecated 用 `codeMap` 代替
   */
  const mergedTileConfigs = computed((): Record<string, AreaTileConfig> => {
    const areaTileConfigs: Record<string, AreaTileConfig> = {}

    for (const maybeAreaCode in mergedTiles.value) {
      // 只保留实际配置，继承用的配置忽略
      if (!/[A-Z]:[A-Z]+(?::\s+)?/.test(maybeAreaCode)) continue

      const tileConfig = mergedTiles.value[maybeAreaCode]
      if (tileConfig.extend) defaultsDeep(tileConfig, mergedTiles.value[tileConfig.extend])

      const {
        code = '',
        name = '',
        center = [0, 0],
        extension = 'png',
        settings = {},
        size = [0, 0],
        tilesOffset = [0, 0],
      } = tileConfig
      const { tags = [], target: rewriteTarget } = AREA_ADDITIONAL_CONFIG_MAP[maybeAreaCode] ?? {}
      const { center: target = [0, 0], zoom = 0 } = settings

      areaTileConfigs[maybeAreaCode] = {
        tags,
        tile: {
          code,
          name,
          center,
          size,
          extension,
          tilesOffset,
        },
        initViewState: {
          target: rewriteTarget ?? target,
          zoom,
        },
      }
    }

    return areaTileConfigs
  })

  /**
   * @key 表示地区 code
   * @value 表示 tile 的相关配置
   */
  const codeMap = computed<Map<string, AreaTileConfig>>(() => {
    const map = new Map<string, AreaTileConfig>()

    for (const areaCode in mergedTiles.value) {
      // 只保留实际配置，继承用的配置忽略
      if (!/[A-Z]:[A-Z]+(?::\s+)?/.test(areaCode)) continue

      const tileConfig = mergedTiles.value[areaCode]
      if (tileConfig.extend) defaultsDeep(tileConfig, mergedTiles.value[tileConfig.extend])

      const {
        code = '',
        name = '',
        center = [0, 0],
        extension = 'png',
        settings = {},
        size = [0, 0],
        tilesOffset = [0, 0],
      } = tileConfig
      const { tags = [], target: rewriteTarget } = AREA_ADDITIONAL_CONFIG_MAP[areaCode] ?? {}
      const { center: target = [0, 0], zoom = 0 } = settings

      map.set(areaCode, {
        tags,
        tile: {
          code,
          name,
          center,
          size,
          extension,
          tilesOffset,
        },
        initViewState: {
          target: rewriteTarget ?? target,
          zoom,
        },
      })
    }

    return map
  })

  /** 当前激活的底图配置 */
  const currentTileConfig = computed(() => {
    if (!areaCode.value) return
    return mergedTileConfigs.value[areaCode.value]
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
  const visibleTagGroups = computed((): AreaTagTuple[][] => {
    const levelTagsMap: AreaTagTuple[][] = []
    const tileConfigs = mergedTileConfigs.value
    for (const areaCode in tileConfigs) {
      const { tags, tile } = tileConfigs[areaCode]
      if (tile.code !== currentTileCode.value) continue
      for (const tag of tags) {
        const { 2: level = 0 } = tag
        if (!levelTagsMap[level as number]) levelTagsMap[level as number] = []
        levelTagsMap[level as number].push(tag)
      }
    }
    return levelTagsMap
  })

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
      tileOptions[tileCode] = { code: areaCode, tile, initViewState, tags: [] }
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
  const toMapCoordinate = ([x, y]: DTO.Coordinate2D): DTO.Coordinate2D => {
    if (!currentTileConfig.value) return [x, y]
    const {
      center: [ox, oy],
    } = currentTileConfig.value.tile
    return [x + ox, y + oy]
  }

  return {
    codeMap,
    mergedTileConfigs,
    currentTileConfig,
    currentTileCode,
    visibleTagGroups,
    visibleArea,
    mapTileOptions,

    toMarkerCoordinate,
    toMapCoordinate,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTileStore, import.meta.hot))
}
