<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { MapWindow } from '../types'
import { Tickets } from '@element-plus/icons-vue'
import { useWindowWorkspace } from '../hooks/windowWorkspace'

defineProps<{ windows: MapWindow.Info[] }>()
const workspace = useWindowWorkspace()
const setButton = (id: string, element: Element | ComponentPublicInstance | null) => {
  workspace.setTaskButton(id, element instanceof HTMLButtonElement ? element : undefined)
}
</script>

<template>
  <div class="window-taskbar">
    <Transition name="window-taskbar" @before-leave="element => element.setAttribute('inert', '')">
      <div v-if="windows.length" class="taskbar-items" role="group" aria-label="最小化的窗口">
        <button
          v-for="info in windows"
          :key="info.generation"
          :ref="element => setButton(info.id, element)"
          class="taskbar-item"
          type="button"
          :title="info.name"
          :aria-label="`恢复${info.name}`"
          @click="workspace.showWindow(info.id)"
        >
          <component :is="info.icon ?? Tickets" class="taskbar-icon" aria-hidden="true" />
          <span class="taskbar-title">{{ info.name }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.window-taskbar {
  position: absolute;
  inset-inline-start: max(12px, env(safe-area-inset-left, 0px));
  inset-inline-end: max(12px, env(safe-area-inset-right, 0px));
  bottom: calc(50px + env(safe-area-inset-bottom, 0px));
  z-index: 1;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.taskbar-items {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  max-width: min(100%, 720px);
  padding: 4px;
  border: 1px solid #a7c5db37;
  border-radius: 14px;
  background: #202c3af5;
  box-shadow: 0 6px 24px #10162255;
  scrollbar-width: thin;
  scrollbar-color: #72879c transparent;
  pointer-events: auto;
}

.taskbar-item {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  height: 44px;
  max-width: 152px;
  padding: 0 10px;
  border-radius: 9px;
  background: #ffffff09;
  color: #edf3f7;
  font-size: 13px;
  touch-action: manipulation;
  cursor: pointer;
}

.taskbar-item:hover,
.taskbar-item:focus-visible {
  background: #ffffff17;
}

.taskbar-item:focus-visible {
  outline: 2px solid #8be5d9;
  outline-offset: -2px;
}

.taskbar-item::after {
  content: '';
  position: absolute;
  bottom: 3px;
  left: calc(50% - 7px);
  width: 14px;
  height: 2px;
  border-radius: 1px;
  background: #7edacf;
}

.taskbar-icon {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  color: #acd6e5;
}

.taskbar-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-taskbar-enter-active,
.window-taskbar-leave-active {
  transition:
    transform 180ms ease-out,
    opacity 180ms ease-out;
}

.window-taskbar-leave-active {
  pointer-events: none;
}

.window-taskbar-enter-from,
.window-taskbar-leave-to {
  transform: translateY(8px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .window-taskbar-enter-active,
  .window-taskbar-leave-active {
    transition: none;
  }
}
</style>
