<script lang="ts" setup>
withDefaults(
  defineProps<{
    height?: number
    color?: string
  }>(),
  {
    height: 48,
    color: '#E2DACE',
  },
)
</script>

<template>
  <div
    v-bind="$attrs"
    class="gs-divider"
    :style="{
      '--height': `${height}px`,
      '--color': color,
    }"
  />
</template>

<style lang="scss" scoped>
.gs-divider {
  --arrow-size: 8px;

  width: 100%;
  height: var(--height);
  position: relative;

  &::before {
    position: absolute;
    width: 100%;
    height: 100%;
    content: '';
    background: linear-gradient(
      to bottom,
      transparent,
      transparent calc(50% - 1px),
      var(--color) calc(50% - 1px),
      var(--color) calc(50% + 1px),
      transparent calc(50% + 1px),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      #000,
      #000 calc(50% - var(--arrow-size)),
      transparent calc(50% - var(--arrow-size)),
      transparent calc(50% + var(--arrow-size)),
      #000 calc(50% + var(--arrow-size)),
      #000
    );
  }
  &::after {
    content: '';
    position: absolute;
    width: var(--arrow-size);
    height: var(--arrow-size);
    border: 3px solid var(--color);
    left: calc(50% - calc(var(--arrow-size) / 2));
    top: calc(50% - calc(var(--arrow-size) / 2));
    outline: 2px solid var(--color);
    outline-offset: 2px;
    rotate: 135deg;
    clip-path: polygon(-100% -100%, 200% -100%, 200% 200%);
    translate: 0 -1px;
  }
}
</style>
