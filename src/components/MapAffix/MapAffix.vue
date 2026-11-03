<script lang="ts" setup>
import type { GenshinMapViewState } from '@/packages/map'
import { mapViewStateKey } from '@/shared'
import { useMapProjection } from './hooks'

interface GenshinMapAffixProps {
  zoomWithMap?: boolean
  pos?: [number, number]
  visible?: boolean
  pickable?: boolean
  noCovertCoord?: boolean
  integer?: boolean
  zIndex?: number
}

const props = withDefaults(defineProps<GenshinMapAffixProps>(), {
  visible: true,
  zIndex: 1,
})

const viewState = inject(
  mapViewStateKey,
  ref<GenshinMapViewState>({
    target: [0, 0],
    zoom: 0,
  }),
)

const { position, scaleRatio } = useMapProjection({
  coord: computed(() => props.pos),
  integer: computed(() => props.integer),
  noCovertCoord: computed(() => props.noCovertCoord),
})

/** 如果选择随地图缩放，则使用缩放比例，否则不变 */
const switchScaleRatio = computed(() => (props.zoomWithMap ? scaleRatio.value : 1))

const affixVisible = computed(() => props.pos !== undefined && props.visible !== false)
</script>

<template>
  <div
    v-if="affixVisible"
    v-bind="$attrs"
    class="gs-map-affix absolute left-0 top-0"
    :class="{
      'pointer-events-auto': pickable,
    }"
    :style="{
      '--sc': switchScaleRatio,
      '--tx': `${position[0]}px`,
      '--ty': `${position[1]}px`,
      'z-index': zIndex,
    }"
    @contextmenu.prevent=""
  >
    <slot name="default" :scale="switchScaleRatio" :zoom="viewState.zoom" />
  </div>
</template>

<style lang="scss" scoped>
.gs-map-affix {
  transform-origin: 0 0;
  translate: var(--tx) var(--ty);
  scale: var(--sc);
}
</style>
