<script lang="ts" setup>
import type { GenshinMapViewState } from '../types'
import { CloseBold, SemiSelect } from '@element-plus/icons-vue'
import { useSubscription } from '@vueuse/rxjs'
import { filter, map, race, switchMap, takeUntil } from 'rxjs'
import {
  globalPointerDown$,
  globalPointerMove$,
  globalPointerup$,
  globalTouchend$,
  globalTouchmove$,
  globalTouchstart$,
} from '@/shared'
import { EaseoutInterpolator } from '../interpolator'

const props = withDefaults(
  defineProps<{
    /** 点击按钮的缩放差，必须为大于 0 小于 1 的值 @default 0.25 */
    deltaZoom?: number
    /**
     * 缩放过渡时间
     * @default 150
     */
    transitionDuration?: number
  }>(),
  {
    deltaZoom: 0.25,
    transitionDuration: 150,
  },
)

const viewState = defineModel<GenshinMapViewState>('modelValue', {
  required: true,
})

const zoom = computed(() => viewState.value.zoom ?? 0)
const minZoom = computed(() => viewState.value.minZoom ?? -4)
const maxZoom = computed(() => viewState.value.maxZoom ?? 0)
const range = computed(() => maxZoom.value - minZoom.value)
const percentage = computed(() => (zoom.value - minZoom.value) / range.value)

const isZooming = autoResetRef(
  false,
  computed(() => props.transitionDuration),
)

const zoomTo = (newPercentage: number, transition = false) => {
  if (transition) {
    if (isZooming.value) return
    isZooming.value = true
  }
  const newZoom = range.value * newPercentage + minZoom.value
  viewState.value = {
    ...viewState.value,
    zoom: newZoom,
    transitionDuration: transition ? props.transitionDuration : 0,
    transitionInterpolator: new EaseoutInterpolator(['target', 'zoom']),
  }
}

const sliderRef = ref<HTMLElement>()

const findSliderIndex = (ev: Event) => {
  return ev.composedPath().findIndex(element => element === sliderRef.value) > -1
}

const calculateH = (percentage: number) => (1 - percentage) * 180

const zoomWith = (startH: number, startY: number, moveY: number) => {
  const deltaY = startH + moveY - startY
  if (deltaY > 180 || deltaY < 0) return
  zoomTo(1 - deltaY / 180)
}

// 基于 touch 的滑动
useSubscription(
  globalTouchstart$
    .pipe(
      filter(startEvent => findSliderIndex(startEvent)),
      switchMap(startEvent => {
        const startY = startEvent.touches[0].clientY
        const startH = calculateH(percentage.value)
        return globalTouchmove$.pipe(
          map(moveEvent => zoomWith(startH, startY, moveEvent.touches[0].clientY)),
          takeUntil(race(globalPointerup$, globalTouchend$)),
        )
      }),
    )
    .subscribe(),
)

// 基于 pointer 的滑动
useSubscription(
  globalPointerDown$
    .pipe(
      filter(startEvent => findSliderIndex(startEvent)),
      switchMap(startEvent => {
        const startY = startEvent.y
        const startH = calculateH(percentage.value)
        return globalPointerMove$.pipe(
          map(moveEvent => zoomWith(startH, startY, moveEvent.y)),
          takeUntil(race(globalTouchstart$, globalPointerup$, globalTouchend$)),
        )
      }),
    )
    .subscribe(),
)
</script>

<template>
  <div class="genshin-zoom-controller" v-bind="$attrs">
    <div
      class="zoom-button cursor-pointer"
      @click="() => zoomTo(Math.min(1, percentage + deltaZoom), true)"
    >
      <el-icon :size="12" color="#FFF7EB" class="rotate-45">
        <CloseBold />
      </el-icon>
    </div>

    <div class="zoom-track relative overflow-visible">
      <div
        ref="sliderRef"
        class="zoom-slider absolute bottom-0 left-0 cursor-pointer"
        :style="{
          '--offset': percentage,
        }"
      >
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="currentColor"
            d="m 0 0 l 64 0 l 0 64 l -64 0 z m 9.37 9.37 q 22.63 22.63 0 45.26 q 22.63 -22.63 45.26 0 q -22.63 -22.63 0 -45.26 q -22.63 22.63 -45.26 0 z"
          />
        </svg>
      </div>
    </div>

    <div
      class="zoom-button cursor-pointer"
      @click="() => zoomTo(Math.max(0, percentage - deltaZoom), true)"
    >
      <el-icon :size="12" color="#FFF7EB">
        <SemiSelect />
      </el-icon>
    </div>
  </div>
</template>

<style scoped>
.genshin-zoom-controller {
  @apply absolute right-0 top-1/2
    flex flex-col items-center gap-2
    z-[9]
    -translate-y-1/2 -translate-x-6
    pointer-events-auto select-none;
}

.zoom-button {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  &::before {
    content: '';
    width: 16px;
    height: 16px;
    position: absolute;
    rotate: 45deg;
    border: 2px solid #fff7eb;
    border-radius: 2px;
  }
}

.zoom-track {
  width: 12px;
  height: 200px;
  border: 1px solid #a8a29a;
  border-radius: 6px;
  background: #333333d0;
}

.zoom-slider {
  width: 18px;
  height: 18px;
  background: #333;
  translate: -4px calc(-180px * var(--offset));
  rotate: 45deg;
  border-radius: 2px;
  overflow: hidden;
  color: #ede5da;
  filter: drop-shadow(0 0 1px #ede5da);
}
</style>
