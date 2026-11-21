import type { MarkerVo } from '@/api/alova/globals'
import type { GSMarkerInfo } from '@/packages/map'
import { ElMessage } from 'element-plus'
import { EaseoutInterpolator, GSMarkerLayer } from '@/packages/map'
import { MapSubject } from '@/shared'
import {
  useAccessStore,
  useArchiveStore,
  useAreaStore,
  useItemStore,
  useMapStateStore,
  useMarkerStore,
  usePreferenceStore,
  useSocketStore,
} from '@/stores'
import { useMapEntitySync } from '@/stores/mapEntitySync'
import { createRenderMarkers } from '@/stores/utils'

let cache: ReturnType<typeof _useMarkerControl>

const MARKER_INTERACTION_KEY = GSMarkerLayer.layerName
// TODO 临时偏移量，后续改为根据侧边栏和视口尺寸实时计算
const FLY_OFFSET = [-200, -200]

const _useMarkerControl = () => {
  const areaStore = useAreaStore()
  const accessStore = useAccessStore()
  const itemStore = useItemStore()
  const markerStore = useMarkerStore()
  const archiveStore = useArchiveStore()
  const mapStateStore = useMapStateStore()
  const preferenceStore = usePreferenceStore()
  const socketStore = useSocketStore()
  const sync = useMapEntitySync()

  const hideMarkerPopover = computed(() => {
    return archiveStore.currentArchive.body.Preference['map.setting.hideMarkerPopover']
  })

  /** 缓存的点位信息, 用于在关闭弹窗时保持信息，使动画显示状态平滑 */
  const cachedMarkerId = ref<number>()
  /** 本地没有详情时，只用调用方提供的坐标定位弹窗。 */
  const focusPlaceholder = shallowRef<GSMarkerInfo>()

  const { hasHover, addFocus, addHover, removeFocus, removeHover } = mapStateStore.interaction

  const { isProcessing: isMultiSelecting } = mapStateStore.subscribeMission(
    'markerMultiSelect',
    () => '',
  )

  const focus = computed(() => {
    if (isMultiSelecting.value || hideMarkerPopover.value) return
    if (mapStateStore.interaction.isPopoverOnHover) {
      const hoverIds = mapStateStore.interaction.hoverElements.get(MARKER_INTERACTION_KEY) as
        | Set<number>
        | undefined
      if (!hoverIds || hoverIds.size > 1) return
      const markerId = hoverIds.values().next().value!
      return mapStateStore.currentMarkerIdMap.get(markerId)
    } else {
      const focusIds = mapStateStore.interaction.focusElements.get(MARKER_INTERACTION_KEY) as
        | Set<number>
        | undefined
      if (!focusIds || focusIds.size > 1) return
      const markerId = focusIds.values().next().value!
      const placeholder = focusPlaceholder.value
      if (placeholder?.id === markerId && placeholder.__gs_isSnapshot) return placeholder
      if (markerStore.deletedIds.has(markerId)) return
      return (
        mapStateStore.currentMarkerIdMap.get(markerId)
        ?? (placeholder?.id === markerId ? placeholder : undefined)
      )
    }
  })

  const hover = computed(() => {
    if (!hasHover(MARKER_INTERACTION_KEY)) return undefined
    const hoverIds = mapStateStore.interaction.hoverElements.get(MARKER_INTERACTION_KEY) as
      | Set<number>
      | undefined
    if (!hoverIds || hoverIds.size > 1) return
    const markerId = hoverIds.values().next().value!
    return mapStateStore.currentMarkerIdMap.get(markerId)
  })

  /** 快照模式，点位只能查看不可交互 */
  const isSnapshot = computed(() => {
    const marker = focus.value
    return Boolean(
      marker
      && (marker.__gs_isSnapshot
        || (!preferenceStore.verifyMarkersOnline && marker === focusPlaceholder.value)),
    )
  })

  const cachedMarkerVo = computed<GSMarkerInfo | null>(() => {
    if (focus.value) return focus.value
    if (cachedMarkerId.value === undefined) return null
    return mapStateStore.currentMarkerIdMap.get(cachedMarkerId.value) ?? null
  })

  /** 是否由 hover 触发弹窗而不是 focus */
  const isPopoverActived = computed(() => focus.value !== undefined)

  const normalizeMarker = (markerVo: MarkerVo | GSMarkerInfo): GSMarkerInfo | undefined => {
    return 'render' in markerVo ? markerVo : createRenderMarkers([markerVo])[0]
  }

  let delayTimer: number | undefined
  let delayedMarkerId: number | undefined

  /** 与 focus 相反的行为 */
  const blur = (markerId?: number) => {
    if (markerId === undefined || delayedMarkerId === markerId) {
      window.clearTimeout(delayTimer)
      delayedMarkerId = undefined
    }
    if (markerId === undefined || focusPlaceholder.value?.id === markerId)
      focusPlaceholder.value = undefined
    removeFocus(MARKER_INTERACTION_KEY, markerId)
    if (markerId !== undefined || mapStateStore.interaction.isPopoverOnHover)
      removeHover(MARKER_INTERACTION_KEY, markerId)
  }

  socketStore.ipc.on('MarkerDeleted', id => {
    if (!socketStore.hasCurrentCredentials) return
    const focused = focus.value
    if (focused?.id === id && focused.__gs_isSnapshot) return
    if (
      preferenceStore.verifyMarkersOnline
      && (focused?.id === id || mapStateStore.staticMarkerIds.has(id))
    )
      ElMessage.warning({ message: '点位已删除', grouping: true })
    blur(id)
  })

  watch(
    () => sync.scope,
    () => {
      blur()
      removeHover(MARKER_INTERACTION_KEY)
      cachedMarkerId.value = undefined
    },
    { flush: 'sync' },
  )

  const focusMarker = (
    markerVo: MarkerVo,
    {
      delay = 0,
      duration = 400,
      snapshot = false,
    }: {
      /** 在将视口移动到点位附近后才真正执行 focus */
      delay?: number
      duration?: number
      snapshot?: boolean
    } = {},
  ) => {
    blur()

    const markerId = markerVo.id
    if (markerId === undefined) {
      ElMessage.error('点位 id 为空')
      return
    }

    if (!snapshot && markerStore.deletedIds.has(markerId)) {
      ElMessage.warning({ message: '点位已删除', grouping: true })
      return
    }
    const current = markerStore.getVisibleMarker(markerId)
    const source = snapshot ? markerVo : (current ?? markerVo)
    if (!accessStore.checkHiddenFlag(source.hiddenFlag)) return
    const rendered = normalizeMarker(source)
    if (!rendered) {
      ElMessage.warning('点位当前无法在地图上定位')
      return
    }
    const markerWithRender = snapshot ? { ...rendered, __gs_isSnapshot: true } : rendered

    focusPlaceholder.value = snapshot || !current ? markerWithRender : undefined

    mapStateStore.setTempMarkers('focus', [markerWithRender])

    // 点位可能不在筛选器的当前地区图层，需要切换到对应的地区
    const { itemList: [firstItem] = [] } = markerWithRender
    void (() => {
      if (!firstItem) return
      const { itemId = -1 } = firstItem
      const item = itemStore.idMap.get(itemId)
      if (item?.areaId === undefined) return
      const area = areaStore.areaIdMap.get(item.areaId)
      if (area?.code === undefined) return
      archiveStore.currentArchive.body.Preference['markerFilter.state.areaCode'] = area.code
    })()

    // 将视口移动到点位附近
    const {
      render: {
        position: [x, y],
      },
    } = markerWithRender
    MapSubject.viewState.next({
      target: [x + FLY_OFFSET[0], y + FLY_OFFSET[1]],
      zoom: 0,
      transitionDuration: duration,
      transitionInterpolator: new EaseoutInterpolator(['target', 'zoom']),
    })

    if (delay > 0) {
      delayedMarkerId = markerId
      delayTimer = window.setTimeout(() => {
        delayedMarkerId = undefined
        if (snapshot || !markerStore.deletedIds.has(markerId))
          addFocus(MARKER_INTERACTION_KEY, markerId, true)
      }, delay)
    } else {
      addFocus(MARKER_INTERACTION_KEY, markerId, true)
    }
  }

  const hoverMarker = (markerVo: MarkerVo | null) => {
    if (!markerVo) {
      removeHover(MARKER_INTERACTION_KEY)
      return
    }
    const markerWithRender = normalizeMarker(markerVo)
    addHover(MARKER_INTERACTION_KEY, markerWithRender?.id)
  }

  /** 与 hover 相反的行为 */
  const out = () => removeHover(MARKER_INTERACTION_KEY)

  watch(
    [() => focus.value?.id, () => mapStateStore.interaction.isPopoverOnHover],
    ([id, isPopoverOnHover]) => {
      if (id !== undefined) cachedMarkerId.value = id
      if (id !== undefined || delayedMarkerId === undefined)
        mapStateStore.setTempMarkers('focus', focus.value && !isPopoverOnHover ? [focus.value] : [])
    },
  )

  watch(
    () => {
      const placeholder = focusPlaceholder.value
      return (
        placeholder?.id !== undefined
        && !placeholder.__gs_isSnapshot
        && markerStore.getVisibleMarker(placeholder.id)
      )
    },
    current => {
      if (current) focusPlaceholder.value = undefined
    },
  )

  return {
    isSnapshot,
    isPopoverActived,
    cachedMarkerVo,
    hover,
    focus,
    normalizeMarker,
    focusMarker,
    blur,
    hoverMarker,
    out,
  }
}

export const useMarkerControl = () => {
  if (!cache) cache = _useMarkerControl()
  return cache
}
