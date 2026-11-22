<script setup lang="ts">
import {
  mapCanvasRef,
  mapContainerHeightKey,
  mapContainerWidthKey,
  mapViewStateKey,
} from '@/shared'
import { useTileStore } from '@/stores'

const props = defineProps<{
  getCoordinate: (point: DTO.Coordinate2D) => DTO.Coordinate2D | undefined
}>()

interface CrosshairReading {
  position: Record<string, string>
  mapX: string
  mapY: string
  markerX: string
  markerY: string
}

const readoutWidth = 232
const readoutHeight = 44
const labelHeight = 22

const tileStore = useTileStore()
const viewState = inject(mapViewStateKey)
const containerWidth = inject(mapContainerWidthKey)
const containerHeight = inject(mapContainerHeightKey)
const reading = shallowRef<CrosshairReading>()

let pointer: PointerEvent | undefined
let bounds: DOMRect | undefined
let frame: number | undefined

const format = (value: number) => {
  const label = value.toFixed(2)
  return label === '-0.00' ? '0.00' : label
}

const placeReadout = (point: number, size: number, extent: number) => {
  const gap = 16
  const inset = 8
  const limit = extent - size - inset
  const after = point + gap
  const start = after > limit && point > extent / 2 ? point - size - gap : after
  return Math.max(inset, Math.min(start, limit))
}

const draw = () => {
  frame = undefined
  const canvas = mapCanvasRef.value
  if (!pointer || !canvas) return

  bounds ??= canvas.getBoundingClientRect()
  const { left, top, width, height } = bounds
  const x = pointer.clientX - left
  const y = pointer.clientY - top
  if (x < 0 || x >= width || y < 0 || y >= height) {
    reading.value = undefined
    return
  }

  const mapPoint = props.getCoordinate([x, y])
  if (!mapPoint) {
    reading.value = undefined
    return
  }
  const markerPoint = tileStore.toMarkerCoordinate(mapPoint)
  const labelX = Math.max(50, Math.min(x, width - 50))
  const labelY = Math.max(14, Math.min(y, height - 14))
  const panelWidth = Math.min(readoutWidth, width - 16)
  const panelX = placeReadout(x, panelWidth, width)
  const panelY = placeReadout(y, readoutHeight, height)

  // 顶部读数避开侧栏按钮、地图状态与添加点位入口。
  const nearLeft = labelX < 120
  const nearRight = labelX > width - 170
  let topLabelY = Math.abs(labelX - width / 2) < 120 ? 44 : 8
  if (nearLeft) topLabelY = 76
  if (nearRight) topLabelY = Math.max(topLabelY, width <= 600 ? 100 : 64)

  if ((nearLeft || nearRight) && Math.abs(topLabelY + labelHeight / 2 - labelY) < labelHeight) {
    topLabelY = labelY + labelHeight / 2 + 4
  }
  const overlapsReadout =
    labelX + 50 > panelX
    && labelX - 50 < panelX + panelWidth
    && topLabelY < panelY + readoutHeight
    && topLabelY + labelHeight > panelY
  if (overlapsReadout) topLabelY = panelY + readoutHeight + 4

  reading.value = {
    position: {
      '--pointer-x': `${x}px`,
      '--pointer-y': `${y}px`,
      '--label-x': `${labelX}px`,
      '--label-y': `${labelY}px`,
      '--label-top': `${Math.max(0, Math.min(topLabelY, height - labelHeight))}px`,
      '--readout-x': `${panelX}px`,
      '--readout-y': `${panelY}px`,
    },
    mapX: format(mapPoint[0]),
    mapY: format(mapPoint[1]),
    markerX: format(markerPoint[0]),
    markerY: format(markerPoint[1]),
  }
}

const scheduleDraw = () => {
  if (pointer && frame === undefined) frame = requestAnimationFrame(draw)
}

const trackPointer = (event: PointerEvent) => {
  if (event.pointerType === 'touch') return
  pointer = event
  scheduleDraw()
}

const hideCrosshair = () => {
  if (frame !== undefined) cancelAnimationFrame(frame)
  frame = undefined
  pointer = undefined
  bounds = undefined
  reading.value = undefined
}

const invalidateBounds = () => {
  bounds = undefined
  scheduleDraw()
}

const leaveMap = (event: PointerEvent) => {
  if (event.pointerType !== 'touch') hideCrosshair()
}

useEventListener(mapCanvasRef, 'pointerenter', trackPointer, { passive: true })
useEventListener(mapCanvasRef, 'pointermove', trackPointer, { passive: true })
useEventListener(mapCanvasRef, 'pointerleave', leaveMap, { passive: true })
useEventListener(mapCanvasRef, 'pointercancel', leaveMap, { passive: true })
useEventListener('blur', hideCrosshair)

watch(mapCanvasRef, hideCrosshair)
watch([() => containerWidth?.value, () => containerHeight?.value], invalidateBounds, {
  flush: 'post',
})
watch(
  [
    () => viewState?.value.zoom,
    () => viewState?.value.target[0],
    () => viewState?.value.target[1],
    () => tileStore.currentTileConfig?.tile.center[0],
    () => tileStore.currentTileConfig?.tile.center[1],
  ],
  scheduleDraw,
  { flush: 'post' },
)
onBeforeUnmount(hideCrosshair)
</script>

<template>
  <div v-if="reading" class="map-pointer-crosshair" :style="reading.position" aria-hidden="true">
    <div class="crosshair-line horizontal" />
    <div class="crosshair-line vertical" />
    <span class="crosshair-label axis-x edge-top">X {{ reading.mapX }}</span>
    <span class="crosshair-label axis-x edge-bottom">X {{ reading.mapX }}</span>
    <span class="crosshair-label axis-y edge-left">Y {{ reading.mapY }}</span>
    <span class="crosshair-label axis-y edge-right">Y {{ reading.mapY }}</span>

    <dl class="crosshair-readout">
      <dt>地图坐标</dt>
      <dd>[{{ reading.mapX }}, {{ reading.mapY }}]</dd>
      <dt>点位坐标</dt>
      <dd>[{{ reading.markerX }}, {{ reading.markerY }}]</dd>
    </dl>
  </div>
</template>

<style scoped>
.map-pointer-crosshair {
  position: absolute;
  inset: 0;
  pointer-events: none;
  user-select: none;
  contain: layout paint;
}

.crosshair-line {
  position: absolute;
  background: #ffe7b6b8;
  box-shadow: 0 0 0 1px #19223070;
}

.crosshair-line.horizontal {
  inset: 0 0 auto;
  height: 1px;
  translate: 0 calc(var(--pointer-y) - 0.5px);
}

.crosshair-line.vertical {
  inset: 0 auto 0 0;
  width: 1px;
  translate: calc(var(--pointer-x) - 0.5px) 0;
}

.crosshair-label,
.crosshair-readout {
  position: absolute;
  border: 1px solid #c9ae76a6;
  background: #222b38f5;
  color: #fff1d3;
  white-space: nowrap;
}

.crosshair-label,
.crosshair-readout dd {
  font-family: ui-monospace, monospace;
}

.crosshair-label {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 16px;
}

.axis-x {
  left: 0;
  translate: calc(var(--label-x) - 50%) 0;
}

.axis-y {
  top: 0;
  translate: 0 calc(var(--label-y) - 50%);
}

.edge-top {
  top: 0;
  translate: calc(var(--label-x) - 50%) max(var(--label-top), env(safe-area-inset-top, 0px));
}

.edge-bottom {
  bottom: max(50px, env(safe-area-inset-bottom, 0px));
}

.edge-left {
  left: max(8px, env(safe-area-inset-left, 0px));
}

.edge-right {
  right: max(46px, env(safe-area-inset-right, 0px));
}

.crosshair-readout {
  top: 0;
  left: 0;
  display: grid;
  width: min(calc(1px * v-bind(readoutWidth)), calc(100% - 16px));
  height: calc(1px * v-bind(readoutHeight));
  align-content: center;
  margin: 0;
  padding: 0 8px;
  translate: var(--readout-x) var(--readout-y);
  border-radius: 6px;
  column-gap: 8px;
  grid-template-columns: max-content minmax(0, 1fr);
  font-size: 12px;
  line-height: 16px;
}

.crosshair-readout dt {
  color: #dac9ab;
}

.crosshair-readout dd {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
}
</style>
