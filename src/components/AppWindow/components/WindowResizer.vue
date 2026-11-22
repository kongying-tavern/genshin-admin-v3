<script setup lang="ts">
import type { MapWindow } from '../types'

defineEmits<{ start: [event: PointerEvent, edge: MapWindow.ResizeEdge] }>()
const edges: MapWindow.ResizeEdge[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
</script>

<template>
  <div class="window-resizer" aria-hidden="true">
    <div
      v-for="edge in edges"
      :key="edge"
      class="resize-handle"
      :class="edge"
      @pointerdown="$emit('start', $event, edge)"
    />
  </div>
</template>

<style scoped>
.window-resizer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.resize-handle {
  position: absolute;
  pointer-events: auto;
  touch-action: none;
  user-select: none;

  &:hover {
    background: #7ff5fe80;
  }
}

.n,
.s {
  left: 8px;
  right: 8px;
  height: 8px;
  cursor: ns-resize;
}

.w,
.e {
  top: 8px;
  bottom: 8px;
  width: 8px;
  cursor: ew-resize;
}

.nw,
.ne,
.sw,
.se {
  width: 11px;
  height: 11px;
}

.n,
.nw,
.ne {
  top: -3px;
}

.s,
.sw,
.se {
  bottom: -3px;
}

.w,
.nw,
.sw {
  left: -3px;
}

.e,
.ne,
.se {
  right: -3px;
}

.nw,
.se {
  cursor: nwse-resize;
}

.ne,
.sw {
  cursor: nesw-resize;
}
</style>
