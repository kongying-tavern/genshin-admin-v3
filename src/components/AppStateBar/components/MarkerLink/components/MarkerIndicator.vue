<script setup lang="ts">
import type { GSMapState } from '@/stores/types/genshin-map-state'
import { MapAffix } from '@/components'

withDefaults(
  defineProps<{
    marker: GSMapState.MarkerWithRenderConfig
    color?: string
  }>(),
  {
    color: '#FFFF00',
  },
)

const id = crypto.randomUUID()
</script>

<template>
  <MapAffix :pos="marker.render.position" :z-index="0" no-covert-coord>
    <template #default="{ zoom }">
      <div
        class="marker-indicator"
        :style="{
          '--scale': 2 ** Math.min(zoom + 2, 0),
          '--color': color,
        }"
      >
        <svg class="indicator-icon" viewBox="0 0 60 60" fill="currentColor">
          <defs>
            <path
              :id="id"
              d="m 2 0 l 18 0 a 1 1 0 0 1 0 2 q -18 0 -18 18 a 1 1 0 0 1 -2 0 l 0 -18 q 0 -2 2 -2"
            />
          </defs>

          <g>
            <use :href="`#${id}`" />
            <use :href="`#${id}`" transform="translate(60 0) rotate(90)" />
            <use :href="`#${id}`" transform="translate(60 60) rotate(180)" />
            <use :href="`#${id}`" transform="translate(0 60) rotate(270)" />
          </g>
        </svg>
      </div>
    </template>
  </MapAffix>
</template>

<style scoped>
@keyframes marker-indicator-anime {
  from {
    transform: scale(1.2);
  }
  to {
    transform: scale(0.9);
  }
}

.marker-indicator {
  width: 40px;
  height: 40px;
  transform-origin: 50% 95%;
  transform: scale(var(--scale)) translate(-50%, -105%);
  color: var(--color);
}

.indicator-icon {
  transform-origin: 50% 50%;
  animation: marker-indicator-anime 50ms ease-out forwards;
}
</style>
