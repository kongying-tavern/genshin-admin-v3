<script lang="ts" setup>
import type { Layer } from 'deck.gl'
import type { GSMarkerInfo } from '@/packages/map'
import { useSubscription } from '@vueuse/rxjs'
import { filter, finalize, switchMap, takeUntil, tap } from 'rxjs'
import { GSButton } from '@/components'
import { GSMarkerLayer } from '@/packages/map'
import { mapCanvasRef, MapSubject } from '@/shared'
import {
  useAccessStore,
  useArchiveStore,
  useMapStateStore,
  usePreferenceStore,
  useShortcutStore,
} from '@/stores'
import { useMarkerPositionEdit } from './hooks'

const accessStore = useAccessStore()
const archiveStore = useArchiveStore()
const mapStateStore = useMapStateStore()
const shortcutStore = useShortcutStore()
const preferenceStore = usePreferenceStore()

// ==================== 移动点位 ====================
const {
  isMissionEmpty,
  isDraggingProcessing,
  draggingMission,
  loading,
  updateDragging,
  moveMarker,
  clearState,
} = useMarkerPositionEdit()

// ==================== 交互事件 ====================
const shortcutKeys = computed(() => {
  return archiveStore.currentArchive.body.Preference['app.shortcutKey.draggingMarker']
})

const { focused } = useFocus(mapCanvasRef)

// 开始点位拖拽
useSubscription(
  shortcutStore.shortcut$
    .pipe(
      filter(({ value }) => {
        return [
          focused.value,
          accessStore.get('MARKER_EDIT'),
          isMissionEmpty.value,
          shortcutKeys.value,
          value === shortcutKeys.value,
        ].every(Boolean)
      }),
    )
    .subscribe(() => {
      updateDragging(new Map())
    }),
)

// 处理拖拽逻辑
useSubscription(
  MapSubject.dragStart
    .pipe(
      filter(({ info }) => {
        // 硬性条件
        const common = [
          // 是否正在加载
          !loading.value,
          // 是否正在拖拽
          isDraggingProcessing.value,
          // 是否是视口
          info.viewport,
          // 是否是点位对象
          info.object
            && (info.layer?.constructor as undefined | typeof Layer)?.layerName
              === GSMarkerLayer.layerName,
        ].every(Boolean)
        if (!common) return false

        // 是否满足可同时移动的点位数量限制
        // 1. 限制 <= 0: 不限制
        if (preferenceStore.markerDraggingCount <= 0) return true

        // 2. 点位已在任务中: 允许继续拖拽更新位置
        if (draggingMission.value.has(info.object.id)) return true

        // 3. 点位不在任务中: 检查任务大小是否小于限制
        return draggingMission.value.size < preferenceStore.markerDraggingCount
      }),

      switchMap(({ info, event: startEvent }) => {
        mapStateStore.setViewPortLocked(true)
        mapStateStore.setCursor('move')

        const { id: markerId, render } = info.object as GSMarkerInfo
        const { x: startX, y: startY } = startEvent.center
        const { zoom } = info.viewport!
        const [markerX, markerY] = draggingMission.value.get(markerId!) ?? render.position

        return MapSubject.drag.pipe(
          tap(({ event: moveEvent }) => {
            const scale = 2 ** -zoom
            const { x: moveX, y: moveY } = moveEvent.center
            const offsetX = (moveX - startX) * scale
            const offsetY = (moveY - startY) * scale
            const newDraggingMap = new Map(draggingMission.value)
            newDraggingMap.set(markerId!, [markerX + offsetX, markerY + offsetY])
            updateDragging(newDraggingMap)
          }),

          takeUntil(MapSubject.dragEnd),

          finalize(() => {
            mapStateStore.setTempMarkers(
              'markerDragging',
              (() => {
                const markers: GSMarkerInfo[] = []
                draggingMission.value.forEach((_, markerId) => {
                  const marker = mapStateStore.currentMarkerIdMap.get(markerId)
                  marker && markers.push(marker)
                })
                return markers
              })(),
            )
            mapStateStore.setViewPortLocked(false)
            mapStateStore.setCursor()
          }),
        )
      }),
    )
    .subscribe(),
)
</script>

<template>
  <Transition name="draw-y" appear mode="in-out">
    <div v-if="isDraggingProcessing" class="marker-move-controller">
      <div class="controller-info-bar">
        <div class="flex-1 text-center">
          <div>正在编辑点位坐标</div>
          <div class="text-xs">共移动 {{ draggingMission.size }} 项</div>
        </div>

        <div class="flex gap-2">
          <GSButton
            icon="submit"
            size="small"
            :disabled="!draggingMission.size"
            :loading="loading"
            @click="moveMarker"
          >
            确定
          </GSButton>
          <GSButton icon="cancel" size="small" :disabled="loading" @click="clearState">
            取消
          </GSButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.marker-move-controller {
  @apply absolute left-0 top-0 w-full h-full z-[10]
    text-[#ECE5D8] font-[HYWenHei-85W]
    pointer-events-none;
}

.controller-info-bar {
  @apply w-1/2 min-w-[360px] max-w-[480px] py-4 px-4 rounded-lg shadow-2xl
    absolute left-1/2 top-0 sm:translate-y-4
    -translate-x-1/2 translate-y-[80px]
    flex gap-4 justify-between items-center
    bg-[#252F39]
    outline outline-1 outline-[gray] -outline-offset-4
    pointer-events-auto;
}
</style>
