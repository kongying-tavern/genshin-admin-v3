<script lang="ts" setup>
defineProps<{
  collapse?: boolean
}>()

defineEmits<{
  (e: 'update:collapse', v?: boolean): void
}>()
</script>

<template>
  <div v-bind="$attrs" class="sidebar-control-layer" :class="{ '-translate-y-full': !collapse }">
    <svg
      width="60"
      height="60"
      viewBox="0 0 100 100"
      class="active:brightness-90 active:scale-95 hover:scale-105 cursor-pointer transition-all duration-150"
      style="filter: drop-shadow(0 0 2px #00000060)"
      @click="() => $emit('update:collapse', !collapse)"
    >
      <defs>
        <path
          id="a"
          d="M50 9.11A40.8922 40.8922 0 0 1 50 90.89A40.8922 40.8922 0 0 1 50 9.11zM50 17.29A32.7138 32.7138 0 0 0 50 82.71A32.7138 32.7138 0 0 0 50 17.29Z"
        />
        <path
          id="b"
          d="M49.21 0.61A0.8178 0.8178 0 0 1 50.79 0.61L57.39 25.26A24.5353 24.5353 0 0 0 74.74 42.61L99.39 49.21A0.8178 0.8178 0 0 1 99.39 50.79L74.74 57.39A24.5353 24.5353 0 0 0 57.39 74.74L50.79 99.39A0.8178 0.8178 0 0 1 49.21 99.39L42.61 74.74A24.5353 24.5353 0 0 0 25.26 57.39L0.61 50.79A0.8178 0.8178 0 0 1 0.61 49.21L25.26 42.61A24.5353 24.5353 0 0 0 42.61 25.26Z"
        />
        <mask id="c">
          <g transform="translate(50,50)scale(1.2)translate(-50,-50)">
            <rect x="0" y="0" width="100" height="100" fill="#fff" />
            <use href="#b" fill="#000" />
          </g>
        </mask>
      </defs>
      <use href="#a" mask="url(#c)" fill="#ECE5D89F" />
      <use href="#b" fill="#ECE5D8" />
    </svg>
  </div>
</template>

<style scoped>
.sidebar-control-layer {
  @apply absolute p-2 z-10 transition-all;
  filter: drop-shadow(0 0 4px black);
  &:hover {
    filter: drop-shadow(0 0 4px #ffff0080);
  }
  &:active {
    filter: drop-shadow(0 0 4px transparent);
  }
}
</style>
