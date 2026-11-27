<script setup lang="ts">
const props = defineProps<{
  bounds?: DTO.OverlayBounds
  origin: DTO.Coordinate2D
  viewport: DTO.Coordinate2D
}>()

const width = 432
const height = 174
const padding = 20

const plot = computed(() => {
  if (!props.bounds) return

  const [start, end] = props.bounds
  const [left, top] = start
  const [right, bottom] = end
  if (right <= left || bottom <= top) return

  const xs = [left, right, props.origin[0], props.viewport[0]]
  const ys = [top, bottom, props.origin[1], props.viewport[1]]
  if (![...xs, ...ys].every(Number.isFinite)) return

  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(...xs) - minX
  const spanY = Math.max(...ys) - minY
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2
  const project = ([x, y]: DTO.Coordinate2D) => ({
    x: offsetX + (x - minX) * scale,
    y: offsetY + (y - minY) * scale,
  })

  return {
    start: project(start),
    end: project(end),
    origin: project(props.origin),
    viewport: project(props.viewport),
  }
})
</script>

<template>
  <figure class="coordinate-figure">
    <div v-if="plot" class="coordinate-grid">
      <svg :viewBox="`0 0 ${width} ${height}`" aria-hidden="true">
        <rect
          class="map-bounds"
          :x="plot.start.x"
          :y="plot.start.y"
          :width="plot.end.x - plot.start.x"
          :height="plot.end.y - plot.start.y"
        />
        <circle class="marker-origin" :cx="plot.origin.x" :cy="plot.origin.y" r="9" />
        <rect
          class="viewport-center"
          :x="plot.viewport.x - 4"
          :y="plot.viewport.y - 4"
          width="8"
          height="8"
          :transform="`rotate(45 ${plot.viewport.x} ${plot.viewport.y})`"
        />
      </svg>
    </div>
    <figcaption v-if="plot" class="coordinate-legend">
      <span><i class="legend-bounds" aria-hidden="true" />底图边界</span>
      <span><i class="legend-origin" aria-hidden="true" />点位原点</span>
      <span><i class="legend-viewport" aria-hidden="true" />初始视口中心</span>
    </figcaption>
    <figcaption v-else class="coordinate-empty">
      当前配置缺少有效图幅，无法绘制坐标示意图。
    </figcaption>
  </figure>
</template>

<style scoped>
.coordinate-figure {
  --origin-color: var(--el-color-primary);
  --viewport-color: var(--el-color-danger);
  margin: 0;
}

.coordinate-grid,
.coordinate-empty {
  border-radius: 6px;
  background-color: var(--el-fill-color-light);
}

.coordinate-grid {
  border: 1px solid var(--el-border-color-lighter);
  background-image:
    linear-gradient(var(--el-border-color-extra-light) 1px, transparent 1px),
    linear-gradient(90deg, var(--el-border-color-extra-light) 1px, transparent 1px);
  background-position: center;
  background-size: 16px 16px;

  svg {
    display: block;
    width: 100%;
    max-height: 180px;
  }
}

.map-bounds {
  fill: var(--el-color-primary-light-9);
  fill-opacity: 0.72;
  stroke: var(--el-text-color-secondary);
  stroke-dasharray: 5 3;
  vector-effect: non-scaling-stroke;
}

.marker-origin {
  fill: none;
  stroke: var(--origin-color);
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

.viewport-center {
  fill: var(--viewport-color);
  stroke: var(--el-bg-color);
  vector-effect: non-scaling-stroke;
}

.coordinate-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 15px;
  margin-top: 7px;
  color: var(--el-text-color-regular);
  font-size: 12px;

  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  i {
    display: block;
    width: 11px;
    height: 11px;
  }

  .legend-bounds {
    border: 1px dashed var(--el-text-color-secondary);
    border-radius: 1px;
  }

  .legend-origin {
    border: 2px solid var(--origin-color);
    border-radius: 100%;
  }

  .legend-viewport {
    width: 8px;
    height: 8px;
    margin-inline: 2px;
    transform: rotate(45deg);
    background: var(--viewport-color);
  }
}

.coordinate-empty {
  padding: 18px 12px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}
</style>
