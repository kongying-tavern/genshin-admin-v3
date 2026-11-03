<script setup lang="ts">
import { AppWindowTeleporter, MapOverlayController, useAppWindow } from '@/components'
import { bodyWidth } from '@/shared'
import { useArchiveStore } from '@/stores'
import BarItem from './BarItem.vue'

const MIN_WIDTH = window.matchMedia('(min-width: 600px)').matches ? 440 : 240

const archiveStore = useArchiveStore()

const overlayVisible = computed({
  get: () => {
    return archiveStore.currentArchive.body.Preference['map.state.showOverlay']
  },
  set: bool => {
    archiveStore.currentArchive.body.Preference['map.state.showOverlay'] = bool
  },
})

const { info, open, close } = useAppWindow(
  computed(() => ({
    name: '附加图层控制器',
    minWidth: MIN_WIDTH,
    minHeight: 420,
    x: bodyWidth.value - MIN_WIDTH - 6,
    y: 8,
    beforeClose: () => {
      overlayVisible.value = false
      return true
    },
  })),
)

watch(overlayVisible, visible => (visible ? open() : close()), { immediate: true })
</script>

<template>
  <BarItem
    divider
    :label="`附加图层：${overlayVisible ? '显示' : '隐藏'}`"
    @click="overlayVisible = !overlayVisible"
  >
    <template #default>
      <div
        class="overlay-status-button grid place-items-center"
        :class="{
          'is-actived': overlayVisible,
        }"
      />

      <AppWindowTeleporter :info="info">
        <MapOverlayController />
      </AppWindowTeleporter>
    </template>
  </BarItem>
</template>

<style scoped>
.overlay-status-button {
  --collapse-size: 32px;
  --btn-icon-offset: -2%;
  --btn-icon-color: gray;
  --radius: 4px;
  --x-scale: 0.6;
  --x-radius: calc(var(--x-scale) * var(--radius));
  --y-offset: calc(40% - var(--btn-icon-offset, 0%));
  --y-gap: 6%;
  --timing: cubic-bezier(0.67, 2.22, 0.93, 1.23);

  width: var(--collapse-size);
  height: var(--collapse-size);
  outline-offset: -6px;
  cursor: pointer;
  transition: all ease 150ms;
  position: relative;

  &.is-actived {
    --btn-icon-offset: -10%;
    --btn-icon-color: #1cffff;
  }

  &:active {
    scale: 0.9;
  }

  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: calc((50% + var(--y-gap)) - var(--btn-icon-offset, 0%));
    width: 60%;
    height: 60%;
    background-color: color-mix(in srgb, var(--btn-icon-color) 50%, #282a2c);
    transform: translate(-50%, -50%) scale(1, var(--x-scale)) rotateZ(45deg);
    border-radius: var(--x-radius) var(--radius) var(--x-radius) var(--radius);
    transition: all ease 150ms;
  }

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: calc((50% - var(--y-gap)) + var(--btn-icon-offset, 0%));
    width: 60%;
    height: 60%;
    background-color: color-mix(in srgb, var(--btn-icon-color) 50%, #ccccccc0);
    transform: translate(-50%, -50%) scale(1, var(--x-scale)) rotateZ(45deg);
    border-radius: var(--x-radius) var(--radius) var(--x-radius) var(--radius);
    transition: all ease 150ms;
  }
}
</style>
