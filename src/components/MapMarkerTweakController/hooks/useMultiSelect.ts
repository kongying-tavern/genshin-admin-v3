import { useSubscription } from '@vueuse/rxjs'
import KDBush from 'kdbush'
import { filter, finalize, fromEvent, map, merge, switchMap, takeUntil, tap } from 'rxjs'
import { useAppWindow } from '@/components'
import { useWindowWorkspace } from '@/components/AppWindow/hooks/windowWorkspace'
import { GSMarkerLayer } from '@/packages/map'
import {
  globalPointerup$,
  mapCanvasRef,
  mapContainerHeightKey,
  mapContainerWidthKey,
  MapSubject,
} from '@/shared'
import { MultiSelect } from '@/shared/enum'
import { useAccessStore, useArchiveStore, useMapStateStore, useShortcutStore } from '@/stores'

const INCREASE_COLOR = '#00FFFD'
const DECREASE_COLOR = '#FFFF00'

export const useMultiSelect = () => {
  const finalizeHook = createEventHook<void>()

  const archiveStore = useArchiveStore()
  const accessStore = useAccessStore()
  const mapStateStore = useMapStateStore()
  const shortcutStore = useShortcutStore()
  const workspace = useWindowWorkspace()

  const height = inject(mapContainerHeightKey, ref(0))
  const width = inject(mapContainerWidthKey, ref(0))

  // ==================== 多选点位 ====================
  const { isFocus, removeFocus } = mapStateStore.interaction

  const removeMultiSelecte = () => removeFocus(GSMarkerLayer.layerName)

  const markerList = computed(() =>
    mapStateStore.currentLayerMarkers.filter(marker => isFocus(GSMarkerLayer.layerName, marker.id)),
  )

  const currentSelectedIds = computed(
    () =>
      mapStateStore.interaction.focusElements.get(GSMarkerLayer.layerName) as
        | Set<number>
        | undefined,
  )

  const {
    data: selectKey,
    end$,
    isEmpty,
    update: setSelectKey,
    clear: clearSelect,
  } = mapStateStore.subscribeMission('markerMultiSelect', () => '')

  const isMatched = computed(() => selectKey.value === MultiSelect.MarkerTweak)

  // ==================== 界面控制 ====================
  const rect = ref<{
    start?: { x: number; y: number }
    end?: { x: number; y: number }
  }>({})

  const shape = computed(() => {
    if (!rect.value?.start || !rect.value.end) return
    const {
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
    } = rect.value
    const xmin = Math.min(x1, x2)
    const xmax = Math.max(x1, x2)
    const ymin = Math.min(y1, y2)
    const ymax = Math.max(y1, y2)
    return {
      xmin,
      xmax,
      ymin,
      ymax,
      width: xmax - xmin,
      height: ymax - ymin,
    }
  })

  const color = ref('transparent')

  // ==================== 框选实现 ====================
  let task: symbol | undefined
  const finalizeMission = () => {
    if (!task) return
    task = undefined
    removeMultiSelecte()
    if (isMatched.value) clearSelect()
    mapStateStore.setViewPortLocked(false)
    mapStateStore.interaction.setIsPopoverOnHover(false)
    mapStateStore.setCursor()
    mapStateStore.setTempMarkers('markerMultiSelect', [])
    rect.value = {}
    finalizeHook.trigger()
  }

  const {
    info: windowInfo,
    isOpen,
    open: openWindow,
    close: closeWindow,
    dispose,
  } = useAppWindow({
    key: 'markerMultiSelect',
    name: '点位批量操作',
    minWidth: 700,
    enabled: () => accessStore.get('MARKER_BATCH_EDIT'),
    onClosed: finalizeMission,
  })

  useSubscription(
    end$.subscribe(() => {
      if (!task) return
      finalizeMission()
      void dispose('mission')
    }),
  )

  const shortcutKeys = computed(() => {
    return archiveStore.preference['app.shortcutKey.multiselectMarker']
  })

  useSubscription(
    shortcutStore.shortcut$
      .pipe(
        filter(({ ev, value }) =>
          [
            accessStore.get('MARKER_BATCH_EDIT'),
            isEmpty.value,
            ev.target === mapCanvasRef.value,
            !workspace.isModal(),
            shortcutKeys.value,
            value === shortcutKeys.value,
          ].every(Boolean),
        ),

        tap(() => {
          const started = Symbol()
          task = started
          setSelectKey(MultiSelect.MarkerTweak)
          void openWindow().then(() => {
            if (task === started && !isOpen.value) finalizeMission()
          })
        }),
      )
      .subscribe(),
  )

  useSubscription(
    MapSubject.dragStart
      .pipe(
        filter(({ info, event }) => {
          return [
            isMatched.value,
            !workspace.isModal(),
            event.leftButton || event.rightButton,
            event.srcEvent.ctrlKey,
            info.coordinate !== undefined,
          ].every(Boolean)
        }),

        switchMap(({ info: startInfo, event: startEvent }) => {
          mapStateStore.setCursor('crosshair')
          mapStateStore.interaction.setIsPopoverOnHover(true)
          mapStateStore.setViewPortLocked(true)
          rect.value.start = startEvent.center

          const [startX, startY] = startInfo.coordinate!

          const currentMarkerList = [...mapStateStore.currentLayerMarkers]

          /** 构造查询树 */
          const tree = new KDBush(currentMarkerList.length)
          currentMarkerList.forEach(
            ({
              render: {
                position: [x, y],
              },
            }) => {
              tree.add(x, y)
            },
          )
          tree.finish()

          /** 缓存的旧数据，用于选择逻辑处理 */
          const oldIds = new Set(currentSelectedIds.value ?? [])

          /** 右键按下时为取消选择模式 */
          const isRemoveMode = startEvent.rightButton === true

          color.value = isRemoveMode ? DECREASE_COLOR : INCREASE_COLOR

          return MapSubject.drag.pipe(
            filter(({ info }) => info.coordinate !== undefined),

            map(({ info: moveInfo, event: moveEvent }) => {
              rect.value.end = moveEvent.center

              const [moveX, moveY] = moveInfo.coordinate!

              const [xmin, xmax] = startX <= moveX ? [startX, moveX] : [moveX, startX]
              const [ymin, ymax] = startY <= moveY ? [startY, moveY] : [moveY, startY]

              /** 本次框选的点位 */
              const range = tree
                .range(xmin, ymin, xmax, ymax)
                .map(index => currentMarkerList[index].id!)

              /** 实际操作的数据 */
              const ids = oldIds[isRemoveMode ? 'difference' : 'union'](new Set(range))

              mapStateStore.interaction.setFocus(GSMarkerLayer.layerName, ids)
            }),

            takeUntil(
              merge(globalPointerup$, fromEvent(window, 'pointercancel'), MapSubject.blur, end$),
            ),

            // 注意！这里不是直接恢复初始状态，而是恢复到更新选择矩形之前的状态。
            // 只有当多选点位弹出的操作窗口关闭后才恢复到初始状态。
            finalize(() => {
              if (!task) return
              mapStateStore.setCursor()
              mapStateStore.setViewPortLocked(false)
              mapStateStore.setTempMarkers('markerMultiSelect', markerList.value)
              rect.value = {}
            }),
          )
        }),
      )
      .subscribe(),
  )

  onUnmounted(finalizeMission)

  return {
    windowInfo,
    width,
    height,
    shape,
    currentSelectedIds,
    markerList,
    isMatched,

    finalizeMission,
    closeWindow,
    onFinalize: finalizeHook.on,
  }
}
