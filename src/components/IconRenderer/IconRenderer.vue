<script lang="ts" setup>
import { IconUnknown } from '@/components/AppIcons'
import { useIconStore } from '@/stores'

const props = withDefaults(
  defineProps<{
    /** 图标 id */
    iconId?: number
    /** 图标宽度 @default 64 */
    width?: number
    /** 图标高度 @default 64 */
    height?: number
  }>(),
  {
    width: 64,
    height: 64,
  },
)

const iconStore = useIconStore()

const position = computed(() => {
  if (!props.iconId) return
  return iconStore.iconCoordMap.get(props.iconId)
})
</script>

<template>
  <div class="image-container">
    <slot v-if="!position" name="fallback">
      <IconUnknown />
    </slot>

    <div
      v-else
      class="image-renderer"
      draggable="false"
      :style="{
        '--icon': `url(${iconStore.iconTextureUrl})`,
        '--w': `${props.width}px`,
        '--h': `${props.height}px`,
        '--x': `${-position[0]}px`,
        '--y': `${-position[1]}px`,
      }"
    />
  </div>
</template>

<style scoped>
@property --renderer-container-width {
  syntax: '<length>';
  initial-value: 0px;
  inherits: false;
}

@property --renderer-container-height {
  syntax: '<length>';
  initial-value: 0px;
  inherits: false;
}

.image-container {
  container-type: size;
}

.image-renderer {
  --renderer-container-width: 100cqw;
  --renderer-container-height: 100cqh;
  --scale-x: tan(atan2(var(--renderer-container-width), var(--w)));
  --scale-y: tan(atan2(var(--renderer-container-height), var(--h)));

  width: var(--w);
  height: var(--h);
  transform-origin: top left;
  transform: scale(var(--scale-x), var(--scale-y));
  background: var(--icon);
  background-position: var(--x) var(--y);
}
</style>
