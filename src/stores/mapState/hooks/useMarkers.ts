import type { AreaVo, ItemVo, MarkerVo } from '@/api/alova/globals'
import type { GSMarkerInfo, TempMarkerType, TempMarkerTypeMap } from '@/packages/map'
import type {
  AreaTileConfig,
  useArchiveStore,
  useAreaStore,
  useItemStore,
  useItemTypeStore,
  useMarkerStore,
  useTileStore,
} from '@/stores'
import type { MAFMeta } from '@/stores/types'
import { toValue } from 'vue'
import { createRenderMarkers } from '@/stores/utils'
import { useMarkerAdvancedFilter, useMarkerFilter } from '.'

interface MarkerHookOptions {
  archiveStore: ReturnType<typeof useArchiveStore>
  markerStore: ReturnType<typeof useMarkerStore>
  tileStore: ReturnType<typeof useTileStore>
  areaStore: ReturnType<typeof useAreaStore>
  itemTypeStore: ReturnType<typeof useItemTypeStore>
  itemStore: ReturnType<typeof useItemStore>
}

export const useMarkers = (options: MarkerHookOptions) => {
  const { archiveStore, markerStore, tileStore, areaStore, itemStore } = options

  const { markerFilterType } = useMarkerFilter(options)
  const { getMAFConfig } = useMarkerAdvancedFilter(options)

  /** 筛选处理状态 */
  const markersFilterLoading = ref(false)

  /**
   * 渲染对象缓存
   *
   * 点位的渲染配置只取决于「点位自身 + 底图配置 + 地区索引 + 物品索引」。
   * 索引不变时可以直接复用上一次的渲染对象，使分片更新只需为新增点位付出分配成本，
   * 而不是每次都把几万个点位对象重新展开一遍。
   *
   * 这里不使用 watch 重置缓存：computed 的重新求值可能早于 watch 回调，
   * 会读到上一轮的过期缓存。改为在求值时比对依赖引用，保证永远一致。
   */
  let renderCache = new WeakMap<MarkerVo, GSMarkerInfo>()
  let renderCacheDeps: unknown[] | undefined

  const getRenderCache = (
    tileConfigs: Record<string, AreaTileConfig>,
    areaIdMap: Map<number, AreaVo>,
    itemIdMap: Map<number, ItemVo>,
  ) => {
    const deps = renderCacheDeps
    if (deps && deps[0] === tileConfigs && deps[1] === areaIdMap && deps[2] === itemIdMap) {
      return renderCache
    }
    renderCache = new WeakMap()
    renderCacheDeps = [tileConfigs, areaIdMap, itemIdMap]
    return renderCache
  }

  const archiveItemIds = computed(
    () => archiveStore.currentArchive.body.Preference['markerFilter.state.itemIds'] ?? [],
  )
  const advancedFilter = computed(
    () => archiveStore.currentArchive.body.Preference['markerFilter.filter.advancedFilter'] ?? [],
  )

  /** 当前基础筛选器（地区-类型-物品）条件表示下的所有点位 */
  const markersForBasicFilter = computed(() => {
    const tileConfigs = tileStore.mergedTileConfigs
    if (!tileConfigs) return []

    const areaIdMap = areaStore.areaIdMap
    const itemIdMap = itemStore.itemIdMap
    const itemIds = new Set(archiveItemIds.value)
    const res = markerStore.markerList.filter(({ itemList = [] }) => {
      for (const { itemId } of itemList) {
        if (itemIds.has(itemId!)) return true
      }
      return false
    })
    return createRenderMarkers(res, {
      tileConfigs,
      areaIdMap,
      itemIdMap,
      cache: getRenderCache(tileConfigs, areaIdMap, itemIdMap),
    })
  })

  /** 当前高级筛选器条件表示下的所有点位 */
  const markersForAdvancedFilter = computed(() => {
    const tileConfigs = tileStore.mergedTileConfigs
    if (!tileConfigs) return []
    const areaIdMap = areaStore.areaIdMap
    const itemIdMap = itemStore.itemIdMap

    /** 合并计算布尔值，支持 null 值 */
    const operateBool = (v1: boolean | null, v2: boolean | null, op: boolean): boolean | null => {
      if (v1 === null) return v2
      else if (v2 === null) return v1
      else return op ? v1 && v2 : v1 || v2
    }
    /** 判断是否可以进行逻辑截断，可逻辑截断时返回 true */
    const breakBool = (v: boolean | null, op: boolean): boolean =>
      (v === true && !op) || (v === false && op)

    const metaCache = new Map<string, MAFMeta>()
    const res = markerStore.markerList.filter((marker: MarkerVo) => {
      let globalVal: boolean | null = null
      for (let groupIndex = 0; groupIndex < advancedFilter.value.length; groupIndex++) {
        const group = advancedFilter.value[groupIndex]
        if (breakBool(globalVal, group.operator)) break

        let groupVal: boolean | null = null
        for (let itemIndex = 0; itemIndex < group.children.length; itemIndex++) {
          const item = group.children[itemIndex]
          if (breakBool(groupVal, item.operator)) break

          const filterConfig = getMAFConfig(item.id)
          const filterId = filterConfig.id
          if (filterId === null || filterId === undefined || filterId <= 0) continue

          const {
            prepare: filterPrepare,
            option: filterOption,
            filter: filterAction,
          } = filterConfig
          const itemMetaKey: string = `${groupIndex}-${itemIndex}`
          let itemMeta: MAFMeta | undefined = metaCache.get(itemMetaKey)
          if (!itemMeta) {
            itemMeta = filterPrepare(item.value, toValue(filterOption))
            metaCache.set(itemMetaKey, itemMeta)
          }
          let itemVal: boolean = filterAction(item.value, toValue(filterOption), itemMeta, marker)
          if (item.opposite) itemVal = !itemVal
          groupVal = operateBool(groupVal, itemVal, item.operator)
        }

        if (group.opposite) groupVal = !groupVal
        globalVal = operateBool(globalVal, groupVal, group.operator)
      }

      return globalVal
    })
    return createRenderMarkers(res, {
      tileConfigs,
      areaIdMap,
      itemIdMap,
      cache: getRenderCache(tileConfigs, areaIdMap, itemIdMap),
    })
  })

  /** 当前混合选择器 */
  const markersForFilter = computed(() => {
    switch (markerFilterType.value) {
      case 'advanced':
        return markersForAdvancedFilter.value
      case 'basic':
      default:
        return markersForBasicFilter.value
    }
  })

  /** 将点位分配到对应的底图中 */
  const markersGroupByTile = computed(() =>
    Object.groupBy(markersForFilter.value, marker => {
      return marker.render.tileCode
    }),
  )

  // ==================== 临时点位 - start ====================

  const staticMarkers = computed(() => {
    const { currentTileCode } = tileStore
    if (!currentTileCode) return []
    return markersGroupByTile.value[currentTileCode] ?? []
  })

  const staticMarkerIds = computed(() => new Set(staticMarkers.value.map(marker => marker.id!)))

  /** 临时点位集合 */
  const tempMarkerMap = shallowRef(new Map<keyof TempMarkerTypeMap, GSMarkerInfo[]>())

  /** 未去重的临时点位 */
  const undifferentiated = computed(() => {
    const markers: GSMarkerInfo[] = []
    tempMarkerMap.value.forEach(typeMarkers => {
      markers.push(...typeMarkers)
    })
    return markers
  })

  /** 已去重并经过预渲染处理的临时点位 */
  const tempMarkers = computed(() => {
    const tileConfigs = tileStore.mergedTileConfigs
    if (!tileConfigs) return []
    const ids = new Set(staticMarkerIds.value)
    const differentiated = undifferentiated.value.filter(marker => {
      if (ids.has(marker.id!)) return false
      ids.add(marker.id!)
      return true
    })
    return differentiated
  })

  const setTempMarkers = <K extends keyof TempMarkerTypeMap>(
    type: TempMarkerType,
    markers: TempMarkerTypeMap[K],
  ) => {
    const { mergedTileConfigs: tileConfigs } = tileStore
    const { areaIdMap } = areaStore
    const { itemIdMap } = itemStore
    const map = new Map(tempMarkerMap.value)
    map.set(
      type,
      createRenderMarkers(markers, {
        tileConfigs,
        areaIdMap,
        itemIdMap,
        isTemporary: true,
      }),
    )
    tempMarkerMap.value = map
  }

  const setTempMarkersBy = <K extends keyof TempMarkerTypeMap>(
    type: K,
    cb: (oldMarkers: TempMarkerTypeMap[K], setter: (value: TempMarkerTypeMap[K]) => void) => void,
  ) => {
    cb((tempMarkerMap.value.get(type) ?? []) as TempMarkerTypeMap[K], value => {
      setTempMarkers(type, value)
    })
  }

  const clearTempMarkes = () => {
    tempMarkerMap.value = new Map()
  }

  // ====================  临时点位 - end  ====================

  /**
   * 是否正在「按分片追加数据」
   *
   * 只有真的已经有数据落地时才切换到追加顺序，避免空同步时点位绘制顺序
   * 来回翻转（那会造成一次无意义的全量重传）。
   * 该值在一次同步中只会变化一次，不会给下游带来额外重算。
   */
  const isAppendingMarkers = computed(() => {
    if (!markerStore.updateLoading) return false
    const { phase, finished } = markerStore.syncProgress
    return finished > 0 && (phase === 'fetch' || phase === 'persist')
  })

  /**
   * 所属于当前底图的点位，不含临时点位
   * @note 根据 y 轴排序使得下方点位可以遮挡上方点位，降低视觉复杂度
   */
  const currentLayerMarkers = computed(() => {
    const markers = staticMarkers.value
    /**
     * 追加数据期间不排序：保持「只追加」的顺序，deck.gl 才能用区间更新
     * 跳过未变化的行；同步结束后统一排序一次即可。
     */
    if (isAppendingMarkers.value) return markers
    return markers.toSorted(
      (
        {
          render: {
            position: { 1: y1 },
          },
        },
        {
          render: {
            position: { 1: y2 },
          },
        },
      ) => y1 - y2,
    )
  })

  /**
   * 地图全部可见点位，包含临时点位
   */
  const currentMarkers = computed(() => currentLayerMarkers.value.concat(tempMarkers.value))

  const currentMarkerIds = computed(() => currentMarkers.value.map(marker => marker.id!))

  const currentMarkerIdMap = computed(() =>
    currentMarkers.value.reduce((map, marker) => {
      map.set(marker.id!, marker)
      return map
    }, new Map<number, GSMarkerInfo>()),
  )

  return {
    markersFilterLoading,
    markersGroupByTile,
    currentLayerMarkers,
    currentMarkers,
    currentMarkerIds,
    currentMarkerIdMap,
    staticMarkers,
    staticMarkerIds,
    tempMarkers,
    tempMarkerMap,
    setTempMarkers,
    setTempMarkersBy,
    clearTempMarkes,
  }
}
