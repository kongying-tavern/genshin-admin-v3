<script setup lang="ts">
import type { GenshinMapViewState } from '@/packages/map'
import { EaseoutInterpolator } from '@/packages/map'
import { MapSubject, mapViewStateKey } from '@/shared'
import { useTileStore } from '@/stores'
import BarItem from './BarItem.vue'

const tileStore = useTileStore()

const viewState = inject(
  mapViewStateKey,
  ref<GenshinMapViewState>({
    target: [0, 0],
    zoom: 0,
  }),
)

const resetViewState = () => {
  MapSubject.viewState.next({
    ...viewState.value,
    target: [318, 6660],
    zoom: 0,
    transitionDuration: 200,
    transitionInterpolator: new EaseoutInterpolator(['target', 'zoom']),
  })
}

const markerView = computed(() => {
  const {
    target: [x, y],
    zoom,
  } = viewState.value
  const [mx, my] = tileStore.toMarkerCoordinate([x, y])
  return [mx, my, zoom]
})
</script>

<template>
  <BarItem label="视口信息" class="w-14 grid place-content-center" @click="resetViewState">
    <div class="w-16 text-xs translate-x-1.5 translate-y-[0.5px] leading-none overflow-hidden">
      <div class="flex gap-2 scale-[0.8] origin-left overflow-hidden -mb-[2px]">
        <div class="flex-shrink-0">X</div>
        <div class="flex-1 text-right overflow-hidden whitespace-nowrap text-ellipsis">
          {{ Math.floor(markerView[0]) }}
        </div>
      </div>
      <div class="flex gap-2 scale-[0.8] origin-left overflow-hidden">
        <div class="flex-shrink-0">Y</div>
        <div class="flex-1 text-right overflow-hidden whitespace-nowrap text-ellipsis">
          {{ Math.floor(markerView[1]) }}
        </div>
      </div>
      <div class="flex gap-2 scale-[0.8] origin-left overflow-hidden -mt-[2px]">
        <div class="flex-shrink-0">Z</div>
        <div class="flex-1 text-right overflow-hidden whitespace-nowrap text-ellipsis">
          {{ markerView[2].toFixed(2) }}
        </div>
      </div>
    </div>
  </BarItem>
</template>
