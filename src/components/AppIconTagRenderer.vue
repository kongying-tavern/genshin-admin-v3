<script lang="ts" setup>
import { IconUnknown } from '@/components/AppIcons'

const props = defineProps<{
  src?: string
  mapping?: [number, number]
  mask?: string
}>()
</script>

<template>
  <div class="image-container">
    <slot v-if="!src || !mapping" name="default">
      <IconUnknown />
    </slot>

    <div
      v-else
      class="image-renderer"
      :class="{
        'is-mask': mask,
      }"
      draggable="false"
      :style="{
        '--x': `${-mapping[0]}px`,
        '--y': `${-mapping[1]}px`,
        '--mask-color': props.mask,
        '--icon': `url(${src})`,
      }"
    />
  </div>
</template>

<style scoped>
@property --image-container-width {
  syntax: '<length>';
  initial-value: 0px;
  inherits: false;
}

@property --image-container-height {
  syntax: '<length>';
  initial-value: 0px;
  inherits: false;
}

.image-container {
  container-type: size;
}

.image-renderer {
  --image-container-width: 100cqw;
  --image-container-height: 100cqh;
  --scale-x: tan(atan2(var(--image-container-width), 64px));
  --scale-y: tan(atan2(var(--image-container-height), 64px));

  /* 与 src\worker\tagSpriteRenderer\renderer.worker.ts 接收到的值同步 */
  width: 64px;
  height: 64px;

  transform-origin: top left;
  transform: scale(var(--scale-x), var(--scale-y));
  background: var(--icon);
  background-position: var(--x) var(--y);

  &.is-mask {
    background: var(--mask-color);
    mask: var(--icon);
    mask-position: var(--x) var(--y);
  }
}
</style>
