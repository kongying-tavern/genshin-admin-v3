import type { MarkerVo } from '@/api/alova/globals'
import type { GSMarkerInfo } from '@/packages/map'
import { ElMessage } from 'element-plus'
import { EaseoutInterpolator, GSMarkerLayer } from '@/packages/map'
import { MapSubject } from '@/shared'
import {
  useArchiveStore,
  useAreaStore,
  useItemStore,
  useMapStateStore,
  useMarkerStore,
  useSocketStore,
} from '@/stores'
import { createRenderMarkers } from '@/stores/utils'

let cache: ReturnType<typeof _useMarkerControl>

const MARKER_INTERACTION_KEY = GSMarkerLayer.layerName
// TODO 临时偏移量，后续改为根据侧边栏和视口尺寸实时计算
const FLY_OFFSET = [-200, -200]

const _useMarkerControl = () => {
  const areaStore = useAreaStore()
  const itemStore = useItemStore()
  const markerStore = useMarkerStore()
  const archiveStore = useArchiveStore()
  const mapStateStore = useMapStateStore()
  const socketStore = useSocketStore()

  const hideMarkerPopover = computed(() => {
    return archiveStore.currentArchive.body.Preference['map.setting.hideMarkerPopover']
  })

  /** 缓存的点位信息, 用于在关闭弹窗时保持信息，使动画显示状态平滑 */
  const cachedMarkerId = ref<number>()

  const cachedMarkerVo = computed<GSMarkerInfo | null>(() => {
    if (cachedMarkerId.value === undefined) return null
    return mapStateStore.currentMarkerIdMap.get(cachedMarkerId.value) ?? null
  })

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
      return mapStateStore.currentMarkerIdMap.get(markerId)
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
  const isSnapshot = ref(false)

  /** 是否由 hover 触发弹窗而不是 focus */
  const isPopoverActived = computed(() => focus.value !== undefined)

  whenever(
    () => !focus.value,
    () => {
      mapStateStore.setTempMarkers('focus', [])
    },
  )

  const normalizeMarker = (markerVo: MarkerVo | GSMarkerInfo): GSMarkerInfo => {
    return 'render' in markerVo ? markerVo : createRenderMarkers([markerVo])[0]
  }

  const updateLoading = ref(false)

  const delayTimer = ref<number>()

  /** 与 focus 相反的行为 */
  const blur = (markerId?: number) => {
    if (markerId !== undefined && focus.value?.id !== markerId) return
    removeFocus(MARKER_INTERACTION_KEY)
  }

  socketStore.ipc.on('MarkerDeleted', id => {
    blur(id)
  })

  const focusMarker = (
    markerVo: MarkerVo,
    {
      delay = 0,
      duration = 400,
    }: {
      /** 在将视口移动到点位附近后才真正执行 focus */
      delay?: number
      duration?: number
    } = {},
  ) => {
    blur()
    window.clearTimeout(delayTimer.value)

    if (markerVo.id === undefined) {
      ElMessage.error('点位 id 为空')
      return
    }

    const existMarkerInfo = markerStore.idMap.get(markerVo.id)
    const markerWithRender = existMarkerInfo
      ? normalizeMarker(existMarkerInfo)
      : normalizeMarker(markerVo)

    // 如果无法在当前数据中查询到所给的点位信息，则只能使用快照模式
    isSnapshot.value = !existMarkerInfo

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
      delayTimer.value = window.setTimeout(() => {
        addFocus(MARKER_INTERACTION_KEY, markerWithRender.id, true)
        delayTimer.value = undefined
      }, delay)
    } else {
      addFocus(MARKER_INTERACTION_KEY, markerWithRender.id, true)
    }
  }

  const hoverMarker = (markerVo: MarkerVo | null) => {
    if (!markerVo) {
      removeHover(MARKER_INTERACTION_KEY)
      return
    }
    const markerWithRender = normalizeMarker(markerVo)
    addHover(MARKER_INTERACTION_KEY, markerWithRender.id)
  }

  /** 与 hover 相反的行为 */
  const out = () => removeHover(MARKER_INTERACTION_KEY)

  watch(
    () => [focus.value, mapStateStore.interaction.isPopoverOnHover] as const,
    ([currentFocus, isPopoverOnHover]) => {
      if (!currentFocus) {
        !isPopoverOnHover && mapStateStore.setTempMarkers('focus', [])
        return
      }
      cachedMarkerId.value = currentFocus.id
      !isPopoverOnHover && mapStateStore.setTempMarkers('focus', [currentFocus])
    },
  )

  return {
    isSnapshot,
    isPopoverActived,
    cachedMarkerVo,
    hover,
    focus,
    updateLoading,
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
