<script lang="ts" setup>
import { useSubscription } from '@vueuse/rxjs'
import KDBush from 'kdbush'
import { filter, finalize, switchMap, takeUntil, tap } from 'rxjs'
import { GSMarkerLayer } from '@/packages/map'
import {
  globalKeyUp$,
  globalPointerup$,
  mapCanvasRef,
  mapContainerHeightKey,
  mapContainerWidthKey,
  MapSubject,
} from '@/shared'
import { MultiSelect } from '@/shared/enum'
import { useArchiveStore, useMapStateStore, useShortcutStore } from '@/stores'

const archiveStore = useArchiveStore()
const mapStateStore = useMapStateStore()
const shortcutStore = useShortcutStore()

const MARKED_COLOR = '#00FFFD'
const UNMARKED_COLOR = '#FFFF00'

// ==================== 任务 ====================
const {
  data: selectKey,
  isEmpty,
  update: setSelectKey,
  clear: cancelSelect,
} = mapStateStore.subscribeMission('markerMultiSelect', () => '')

const isMatched = computed(() => selectKey.value === MultiSelect.MarkerToggle)

// ==================== 图形 ====================
const eventState = ref<{
  start?: { x: number; y: number }
  end?: { x: number; y: number }
}>({})

const width = inject(mapContainerWidthKey, ref(0))
const height = inject(mapContainerHeightKey, ref(0))

/** 选框图形 */
const shape = computed(() => {
  if (!eventState.value.start || !eventState.value.end) return
  const {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
  } = eventState.value
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

/** 选框颜色 */
const stroke = ref('transparet')

// ==================== 交互 ====================
const shortcutKeys = computed(() => {
  return archiveStore.currentArchive.body.Preference['app.shortcutKey.toggleMarkerState']
})

const { focused } = useFocus(mapCanvasRef)

// 响应快捷键，开启任务
const start$ = shortcutStore.shortcut$.pipe(
  filter(({ value }) => {
    return [isEmpty.value, focused.value, shortcutKeys.value, value === shortcutKeys.value].every(
      Boolean,
    )
  }),

  tap(() => {
    setSelectKey(MultiSelect.MarkerToggle)
  }),
)

// 处理框选和状态改变逻辑
const core$ = start$.pipe(
  switchMap(() =>
    MapSubject.dragStart.pipe(
      filter(({ event }) =>
        [isMatched.value, event.leftButton || event.rightButton].every(Boolean),
      ),

      tap(() => {
        mapStateStore.setCursor('crosshair')
      }),

      switchMap(({ info: startInfo, event: startEvent }) => {
        // 左键为标记模式，右键为取消标记模式
        const isRemoveMode = startEvent.rightButton === true

        eventState.value.start = startEvent.center
        stroke.value = isRemoveMode ? UNMARKED_COLOR : MARKED_COLOR

        const currentLayerMarkers = [...mapStateStore.currentLayerMarkers]
        const ids = new Set<number>()

        // 构造查询树
        const tree = new KDBush(currentLayerMarkers.length)
        currentLayerMarkers.forEach(
          ({
            render: {
              position: [x, y],
            },
          }) => {
            tree.add(x, y)
          },
        )
        tree.finish()

        const [startX, startY] = startInfo.coordinate!

        return MapSubject.drag.pipe(
          filter(({ info }) => info.coordinate !== undefined),

          tap(({ info: moveInfo, event }) => {
            eventState.value.end = event.center

            const [moveX, moveY] = moveInfo.coordinate!
            const [xmin, xmax] = startX <= moveX ? [startX, moveX] : [moveX, startX]
            const [ymin, ymax] = startY <= moveY ? [startY, moveY] : [moveY, startY]

            ids.clear()

            tree.range(xmin, ymin, xmax, ymax).forEach(index => {
              const marker = currentLayerMarkers[index]
              ids.add(marker.id!)
            })

            mapStateStore.interaction.setFocus(GSMarkerLayer.layerName, new Set(ids))
          }),

          takeUntil(globalPointerup$),

          finalize(async () => {
            stroke.value = 'transparent'
            eventState.value = {}
            if (isRemoveMode)
              ids.forEach(id => archiveStore.currentArchive.body.Data_KYJG.delete(id))
            else ids.forEach(id => archiveStore.currentArchive.body.Data_KYJG.add(id))
            ids.clear()
            mapStateStore.setCursor()
            mapStateStore.interaction.removeFocus(GSMarkerLayer.layerName)
            await archiveStore.flush()
          }),
        )
      }),

      takeUntil(globalKeyUp$),

      finalize(() => {
        cancelSelect()
        stroke.value = 'transparent'
        eventState.value = {}
      }),
    ),
  ),
)

useSubscription(core$.subscribe())
</script>

<template>
  <div v-if="isMatched" class="marker-toggle-controller">
    <svg v-if="shape" :viewBox="`0 0 ${width} ${height}`" fill="transparent">
      <rect
        :x="shape.xmin"
        :y="shape.ymin"
        :width="shape.width"
        :height="shape.height"
        :stroke="stroke"
        stroke-width="2"
      />
    </svg>

    <div class="controller-footer">
      <div class="w-[180px]">批量操作：</div>
      <div class="w-[180px]">左键框选来<span :style="`color: ${MARKED_COLOR}`">标记</span>点位</div>
      <div class="w-[180px]">
        右键框选来<span :style="`color: ${UNMARKED_COLOR}`">取消标记</span>点位
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes controller-info-anime-in {
  from {
    translate: 0 -200px;
  }
  to {
    translate: 0 0;
  }
}

@keyframes controller-footer-anime-in {
  from {
    translate: 0 200px;
  }
  to {
    translate: 0 0;
  }
}

.marker-toggle-controller {
  @apply absolute left-0 top-0 w-full h-full z-[10]
    text-[#ECE5D8] font-[HYWenHei-85W]
    pointer-events-none;
}

.controller-footer {
  @apply w-full py-6
    absolute bottom-0
    flex flex-col items-center
    bg-[#252F39]
    pointer-events-auto;
  animation: controller-footer-anime-in 150ms ease;
}
</style>
