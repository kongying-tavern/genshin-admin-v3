<script setup lang="ts">
import { Deck, OrthographicView } from 'deck.gl'
import { useTerrainLayers } from '@/hooks/useMapLayers'

const props = defineProps<{ target: DTO.Coordinate2D }>()
const heading = defineModel<number>('heading', { required: true })
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const layers = useTerrainLayers()
const viewState = computed(() => ({ target: props.target, zoom: 0 }))
const overlayId = useId()
let deck: Deck<OrthographicView> | undefined
let releaseContext: (() => void) | undefined

onMounted(() => {
  if (!canvas.value) return
  deck = new Deck({
    canvas: canvas.value,
    views: new OrthographicView({ id: 'placement-minimap', controller: false }),
    viewState: viewState.value,
    layers: layers.value,
    onDeviceInitialized: device => {
      // 连续打点会反复打开小地图，关闭时及时归还它独占的 WebGL 上下文。
      releaseContext = () => device.loseDevice()
    },
  })
})

watch([viewState, layers], ([viewState, layers]) => deck?.setProps({ viewState, layers }))
onBeforeUnmount(() => {
  deck?.finalize()
  releaseContext?.()
})
</script>

<template>
  <div class="placement-minimap" role="group" aria-label="选址小地图">
    <div class="minimap-face" aria-hidden="true">
      <div class="minimap-terrain">
        <canvas ref="canvas" tabindex="-1" />
        <!-- 选址点是 SVG 原点，三角图标和视野扇形绕同一中心旋转。 -->
        <svg viewBox="-371 -371 742 742">
          <defs>
            <radialGradient
              :id="`${overlayId}-cone`"
              gradientUnits="userSpaceOnUse"
              cx="0"
              cy="0"
              r="366"
            >
              <stop stop-color="#fff7df" stop-opacity=".4" />
              <stop offset=".65" stop-color="#fff7df" stop-opacity=".16" />
              <stop offset="1" stop-color="#fff7df" stop-opacity="0" />
            </radialGradient>
            <path
              :id="`${overlayId}-arrow-outline`"
              d="M-2 -40Q0 -44 2 -40L38 29Q40 33 36 32L18 30 0 45 -18 30 -36 32
                Q-40 33 -38 29Z"
            />
            <linearGradient
              :id="`${overlayId}-arrow-body`"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="-42"
              x2="0"
              y2="32"
            >
              <stop stop-color="#00d6ff" />
              <stop offset=".56" stop-color="#00eeff" />
              <stop offset="1" stop-color="#00deff" />
            </linearGradient>
            <linearGradient
              :id="`${overlayId}-arrow-tail`"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="15"
              x2="0"
              y2="45"
            >
              <stop stop-color="#00e5ff" />
              <stop offset=".45" stop-color="#00fcff" />
              <stop offset=".78" stop-color="#00fcff" />
              <stop offset="1" stop-color="#56f7ff" />
            </linearGradient>
            <filter
              :id="`${overlayId}-arrow-glow`"
              filterUnits="userSpaceOnUse"
              x="-64"
              y="-64"
              width="128"
              height="128"
            >
              <feGaussianBlur stdDeviation="6.5" />
            </filter>
          </defs>
          <g :transform="`rotate(${heading})`">
            <path d="M0 0 -213 -298a366 366 0 0 1 426 0Z" :fill="`url(#${overlayId}-cone)`" />
            <g>
              <use
                :href="`#${overlayId}-arrow-outline`"
                :filter="`url(#${overlayId}-arrow-glow)`"
                fill="#009cda"
                opacity=".85"
              />
              <use :href="`#${overlayId}-arrow-outline`" :fill="`url(#${overlayId}-arrow-body)`" />
              <path d="M-1 -12Q0 -14 1 -12L22 25Q0 30 -22 25Z" fill="#00cfff" />
              <path d="M0 15 18 30 0 45 -18 30Z" :fill="`url(#${overlayId}-arrow-tail)`" />
              <path d="M-18 30 0 45 18 30 0 42Z" fill="#53f9ff" fill-opacity=".7" />
            </g>
          </g>
        </svg>
      </div>
      <span class="minimap-north">N</span>
    </div>
    <label class="minimap-heading">
      <span>朝向</span>
      <input
        v-model.number="heading"
        type="range"
        min="0"
        max="359"
        step="1"
        aria-label="三角朝向"
        :aria-valuetext="`${heading} 度`"
      />
      <span class="minimap-degrees">{{ heading }}°</span>
    </label>
  </div>
</template>

<style scoped>
.placement-minimap {
  --minimap-size: min(188px, 42vw, 40vh);
  width: var(--minimap-size);
  flex: none;
  pointer-events: none;
  user-select: none;
}

.minimap-face {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle closest-side, transparent 72%, #587db333 92%, transparent);
}

.minimap-face::after {
  position: absolute;
  inset: 0;
  border: 2px solid var(--placement-ink);
  border-radius: inherit;
  content: '';
}

.minimap-terrain {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  background: #243951;
  mask-image: radial-gradient(circle closest-side, black 67%, #000e 78%, #0006 92%, transparent);
}

.minimap-terrain canvas,
.minimap-terrain svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.minimap-north {
  position: absolute;
  top: 4%;
  width: 100%;
  color: #f6f2e9dc;
  font:
    bold calc(var(--minimap-size) * 0.095) / 1 Georgia,
    serif;
  text-align: center;
  text-shadow: 0 1px 3px #18273e;
}

.minimap-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 0 9px;
  border: 1px solid #dcc8a052;
  border-radius: 20px;
  background: #212937ed;
  color: #f2e8d5;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  pointer-events: auto;
}

.minimap-heading input {
  flex: 1;
  min-width: 0;
  height: 30px;
  margin: 0;
  accent-color: #58e6f6;
  cursor: pointer;
}

.minimap-heading:has(input:focus-visible) {
  outline: 2px solid #ffe2a5;
  outline-offset: 2px;
}

.minimap-heading input:focus-visible {
  outline: none;
}

.minimap-degrees {
  min-width: 3.6ch;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
