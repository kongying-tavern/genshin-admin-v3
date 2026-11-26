<script setup lang="ts">
import type { PlacementAxis } from './placementGeometry'
import { clamp } from '@vueuse/core'
import { reticleSquareOffset } from './placementGeometry'

const props = defineProps<{
  point: DTO.Coordinate2D
  viewport: DTO.Coordinate2D
  visibleAxes: readonly [boolean, boolean]
  activeAxis?: PlacementAxis
}>()
const emit = defineEmits<{ press: [event: PointerEvent, axis: PlacementAxis] }>()

const guideAxes = [
  { axis: 1, direction: 'horizontal', hint: '上下拖动，微调瞄准点纵坐标' },
  { axis: 0, direction: 'vertical', hint: '左右拖动，微调瞄准点横坐标' },
] as const
const guides = computed(() =>
  guideAxes.map(guide => {
    const { axis } = guide
    const alongAxis = axis === 0 ? 1 : 0
    const coordinate = props.point[axis]
    const crossExtent = props.viewport[axis]
    const length = props.viewport[alongAxis]
    const split = props.point[alongAxis]
    // 线靠近边缘时把 8px 热区留在视口内，描边仍沿目标坐标绘制。
    const hitSize = Math.min(8, crossExtent)
    const hitStart = clamp(coordinate - hitSize / 2, 0, crossExtent - hitSize)
    const strokeStart = clamp(coordinate - 0.5, 0, Math.max(0, crossExtent - 1))
    const before = clamp(split - reticleSquareOffset, 0, length)
    const after = clamp(length - split - reticleSquareOffset, 0, length)

    return {
      ...guide,
      style: {
        '--guide-hit-start': `${hitStart}px`,
        '--guide-hit-size': `${hitSize}px`,
        '--guide-stroke-offset': `${strokeStart - hitStart}px`,
        '--guide-tracks': `${before}px minmax(0, 1fr) ${after}px`,
      },
    }
  }),
)
</script>

<template>
  <div class="reticle-guides">
    <div
      v-for="guide in guides"
      v-show="visibleAxes[guide.axis]"
      :key="guide.axis"
      class="reticle-guide-axis"
      :class="[guide.direction, { 'is-dragging': activeAxis === guide.axis }]"
      :style="guide.style"
    >
      <span
        v-for="segment in 2"
        :key="segment"
        class="reticle-guide"
        :title="guide.hint"
        @pointerdown.stop="emit('press', $event, guide.axis)"
        @contextmenu.prevent
      />
    </div>
  </div>
</template>

<style scoped>
.reticle-guides {
  position: absolute;
  inset: 0;
}

.reticle-guide-axis {
  --guide-color: #e4ddcc;
  position: absolute;
  display: grid;
}

.reticle-guide-axis.horizontal {
  inset: var(--guide-hit-start) 0 auto;
  height: var(--guide-hit-size);
  grid-template-columns: var(--guide-tracks);
  cursor: ns-resize;
}

.reticle-guide-axis.vertical {
  inset: 0 auto 0 var(--guide-hit-start);
  width: var(--guide-hit-size);
  grid-template-rows: var(--guide-tracks);
  cursor: ew-resize;
}

.reticle-guide {
  position: relative;
  overflow: clip;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}

.horizontal .reticle-guide:last-child {
  grid-column: 3;
}

.vertical .reticle-guide:last-child {
  grid-row: 3;
}

.reticle-guide::before {
  position: absolute;
  background-color: var(--guide-color);
  box-shadow: 0 0 0 1px var(--placement-outline);
  transition: background-color 120ms ease-out;
  content: '';
}

.horizontal .reticle-guide::before {
  inset: var(--guide-stroke-offset) 0 auto;
  height: 1px;
}

.vertical .reticle-guide::before {
  inset: 0 auto 0 var(--guide-stroke-offset);
  width: 1px;
}

@media (hover: hover) {
  .reticle-guide-axis:not(.is-dragging):has(.reticle-guide:hover) {
    --guide-color: #ffcd80;
  }
}

.reticle-guide-axis.is-dragging {
  --guide-color: #fff;
}

@media (prefers-reduced-motion: reduce) {
  .reticle-guide::before {
    transition: none;
  }
}
</style>
