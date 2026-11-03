<script setup lang="ts">
import { useUserStore } from '@/stores'
import { WindowPanel } from './components'
import { useAppWindow, useWindowDrag } from './hooks'

const userStore = useUserStore()

const context = useAppWindow()

const { optimizeWindowPosition } = useWindowDrag(context)

userStore.onBeforeLogout(() => {
  context.clearWindow()
})

onBeforeUnmount(() => {
  context.clearWindow()
})
</script>

<template>
  <div class="map-window-manager">
    <WindowPanel
      v-for="[id, info] in context.getWindows()"
      :id="id"
      :key="id"
      v-model:main-ref="info.ref"
      :context="context"
      :info="info"
      :drag-hook-id="context.dragHookId"
      @optimize-window-position="optimizeWindowPosition"
    />
  </div>
</template>

<style scoped>
.map-window-manager {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 10;
}
</style>
