<script setup lang="ts">
import type { PlacementAxis } from './placementGeometry'
import { clamp } from '@vueuse/core'

const props = defineProps<{
  point: DTO.Coordinate2D
  squareOffset: number
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
    const before = clamp(split - props.squareOffset, 0, length)
    const after = clamp(length - split - props.squareOffset, 0, length)

    return {
      ...guide,
      style: {
        '--guide-hit-start': `${hitStart}px`,
        '--guide-hit-size': `${hitSize}px`,
        '--guide-center-offset': `${coordinate - hitStart}px`,
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
  --guide-bg-color: #fff5debf;
  --guide-color: #33333340;
  position: absolute;
  display: grid;
}

.reticle-guide-axis.horizontal {
  --guide-direction: to right;
  inset: var(--guide-hit-start) 0 auto;
  height: var(--guide-hit-size);
  grid-template-columns: var(--guide-tracks);
  cursor: ns-resize;
}

.reticle-guide-axis.vertical {
  --guide-direction: to bottom;
  inset: 0 auto 0 var(--guide-hit-start);
  width: var(--guide-hit-size);
  grid-template-rows: var(--guide-tracks);
  cursor: ew-resize;
}

.reticle-guide {
  position: relative;
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
  background: repeating-linear-gradient(
    var(--guide-direction),
    var(--guide-color) 0 7px,
    var(--guide-bg-color) 7px 10px
  );
  content: '';
}

.horizontal .reticle-guide::before {
  inset: var(--guide-center-offset) 0 auto;
  height: 1px;
  translate: 0 -50%;
}

.vertical .reticle-guide::before {
  inset: 0 auto 0 var(--guide-center-offset);
  width: 1px;
  translate: -50% 0;
}

@media (hover: hover) {
  .reticle-guide-axis:not(.is-dragging):has(.reticle-guide:hover) {
    --guide-color: #fff5debf;
    --guide-bg-color: #fff5debf;
  }
}

.reticle-guide-axis.is-dragging {
  --guide-color: yellow;
}
</style>
