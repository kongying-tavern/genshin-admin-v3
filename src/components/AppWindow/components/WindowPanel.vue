<script setup lang="ts">
import type { MapWindow } from '../types'
import * as ElIcons from '@element-plus/icons-vue'
import { useAppWindow } from '../hooks'
import { useWindowMotion } from '../hooks/useWindowMotion'
import { useWindowOperation } from '../hooks/useWindowOperation'
import { useWindowWorkspace } from '../hooks/windowWorkspace'
import WindowResizer from './WindowResizer.vue'

const props = defineProps<{ info: MapWindow.Info; order: number }>()
const context = useAppWindow()
const workspace = useWindowWorkspace()
const operation = useWindowOperation(context, () => props.info)
const { preview, nudgeMode } = operation

const HEADER_HEIGHT = 48
const panel = shallowRef<HTMLElement>()
const title = shallowRef<HTMLElement>()
const content = shallowRef<HTMLElement>()
const popups = shallowRef<HTMLElement>()
const menuButton = shallowRef<HTMLButtonElement>()
const actions = shallowRef<HTMLElement>()
const menuOpen = ref(false)

const titleId = computed(() => `window-title-${props.info.id}`)
const contentId = computed(() => `window-content-${props.info.id}`)
const menuId = computed(() => `window-actions-${props.info.id}`)
const minimized = computed(() => props.info.sizeState === 'minimize')
const maximized = computed(() => props.info.sizeState === 'maximize')
const active = computed(() => context.activeId.value === props.info.id)
const rect = computed(() => preview.value ?? props.info.displayRect)
const { leaving, cancel: cancelMotion } = useWindowMotion(
  panel,
  () => props.info.sizeState,
  () => workspace.takeTaskRect(props.info.id),
)
const actionsAbove = computed(() => {
  const height = context.bounds.value?.height ?? 0
  return height - rect.value.y - HEADER_HEIGHT < 116 && rect.value.y >= 116
})

const directions = [
  { key: 'ArrowLeft', label: '向左', icon: ElIcons.ArrowLeft, x: -1, y: 0 },
  { key: 'ArrowUp', label: '向上', icon: ElIcons.ArrowUp, x: 0, y: -1 },
  { key: 'ArrowDown', label: '向下', icon: ElIcons.ArrowDown, x: 0, y: 1 },
  { key: 'ArrowRight', label: '向右', icon: ElIcons.ArrowRight, x: 1, y: 0 },
]

const minimize = () => {
  operation.cancel()
  menuOpen.value = false
  return workspace.minimizeWindow(props.info.id)
}

const toggleMaximize = () => {
  operation.cancel()
  menuOpen.value = false
  context.toggleMaximize(props.info.id)
}

const toggleMenu = async () => {
  menuOpen.value = !menuOpen.value
  if (!menuOpen.value) return
  await nextTick()
  actions.value?.querySelector('button')?.focus()
}

const startNudge = async (mode: 'move' | 'se') => {
  menuOpen.value = false
  operation.startNudge(mode)
  await nextTick()
  actions.value?.focus()
}

const finishNudge = (confirm: boolean) => {
  if (confirm) operation.confirmNudge()
  else operation.cancel()
  menuButton.value?.focus()
}

const nudge = (direction: MapWindow.Coordinate, step = 8) =>
  operation.nudge({ x: direction.x * step, y: direction.y * step })

const onActionKey = (event: KeyboardEvent) => {
  if (event.defaultPrevented || (!menuOpen.value && !nudgeMode.value)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    menuOpen.value = false
    finishNudge(false)
    return
  }
  if (!nudgeMode.value || !(event.target instanceof Node) || !actions.value?.contains(event.target))
    return
  const direction = directions.find(({ key }) => key === event.key)
  if (direction) {
    event.preventDefault()
    nudge(direction, event.shiftKey ? 32 : 8)
  } else if (event.key === 'Enter' && event.target === actions.value) {
    event.preventDefault()
    finishNudge(true)
  }
}

watch(
  () => props.info.interactionState,
  state => {
    if (state === 'manual') cancelMotion()
  },
)
watch(context.bounds, cancelMotion)
watch(active, value => {
  if (value) return
  menuOpen.value = false
  if (nudgeMode.value) operation.cancel()
})
watch(
  () => context.getWindow(props.info.id)?.generation,
  generation => {
    if (generation !== props.info.generation) {
      operation.cancel()
      workspace.restoreOnClose(props.info)
    }
  },
  { flush: 'sync' },
)

onMounted(() => {
  if (panel.value && title.value && content.value && popups.value) {
    workspace.register(props.info, {
      panel: panel.value,
      title: title.value,
      content: content.value,
      popups: popups.value,
    })
  } else {
    context.failMount(props.info)
  }
})

onBeforeUnmount(() => workspace.unregister(props.info))
</script>

<template>
  <div
    v-show="!minimized || leaving"
    ref="panel"
    role="dialog"
    :aria-labelledby="titleId"
    :inert="minimized || undefined"
    class="window-instance"
    :class="{ 'is-active': active, 'is-minimized': minimized }"
    :style="{
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      zIndex: order,
      '--header-height': `${HEADER_HEIGHT}px`,
    }"
    @keydown="onActionKey"
  >
    <div class="window-header">
      <div
        :id="titleId"
        ref="title"
        tabindex="-1"
        class="header-title"
        :class="{ 'is-draggable': !maximized }"
        @pointerdown="operation.startPointer($event, 'move')"
      >
        <component v-if="info.icon" :is="info.icon" class="header-icon" aria-hidden="true" />
        <span class="header-label">{{ info.name }}</span>
      </div>

      <div class="header-actions">
        <button
          v-if="!maximized"
          ref="menuButton"
          type="button"
          class="header-action"
          aria-label="窗口操作"
          title="窗口操作"
          :aria-expanded="menuOpen || Boolean(nudgeMode)"
          :aria-controls="menuId"
          @click="toggleMenu"
        >
          <ElIcons.More />
        </button>
        <button
          type="button"
          class="header-action"
          aria-label="最小化窗口"
          title="最小化"
          data-window-minimize
          @click="minimize"
        >
          <ElIcons.Minus />
        </button>
        <button
          type="button"
          class="header-action"
          :aria-label="maximized ? '还原窗口' : '最大化窗口'"
          :title="maximized ? '还原' : '最大化'"
          @click="toggleMaximize"
        >
          <ElIcons.CopyDocument v-if="maximized" />
          <ElIcons.FullScreen v-else />
        </button>
        <button
          type="button"
          class="header-action close-action"
          aria-label="关闭窗口"
          title="关闭"
          @click="context.requestClose(info.id)"
        >
          <ElIcons.Close />
        </button>
      </div>
    </div>

    <div :id="contentId" ref="content" class="window-content" />
    <div v-show="active && !minimized" ref="popups" class="window-popups" />

    <WindowResizer v-if="!maximized && !minimized" @start="operation.startPointer" />

    <div
      v-if="menuOpen || nudgeMode"
      :id="menuId"
      ref="actions"
      class="window-actions"
      :class="{ above: actionsAbove }"
      role="group"
      :aria-label="nudgeMode === 'move' ? '移动窗口' : nudgeMode ? '调整窗口大小' : '窗口操作'"
      tabindex="-1"
    >
      <template v-if="menuOpen">
        <button type="button" @click="startNudge('move')">移动</button>
        <button type="button" @click="startNudge('se')">调整大小</button>
      </template>
      <template v-else>
        <div class="direction-buttons">
          <button
            v-for="direction in directions"
            :key="direction.key"
            type="button"
            :aria-label="direction.label"
            @click="nudge(direction)"
          >
            <component :is="direction.icon" />
          </button>
        </div>
        <button type="button" @click="finishNudge(true)">确认</button>
        <button type="button" @click="finishNudge(false)">取消</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.window-instance {
  --window-menu-visibility: hidden;

  position: absolute;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  pointer-events: auto;
  outline: 1px solid color-mix(in srgb, var(--el-border-color-darker) 50%, transparent 50%);
  transform-origin: top left;
  animation: window-enter 150ms ease-out;
  @apply shadow-sm;

  &.is-active {
    --window-menu-visibility: visible;
    outline-color: #73d7d26b;
    @apply shadow-2xl;
  }

  &.is-minimized {
    pointer-events: none;
  }

  & :deep(.el-popper[role='menu']) {
    visibility: var(--window-menu-visibility);
  }
}

@keyframes window-enter {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .window-instance {
    animation: none;
  }
}

.window-header {
  height: min(100%, var(--header-height));
  flex-shrink: 0;
  background: #303944;
  color: #c4ced6;
  box-shadow: inset 0 -1px #ffffff0c;
  display: flex;
  justify-content: space-between;
  border-radius: 6px 6px 0 0;
  overflow: hidden;
  user-select: none;
}

.is-active .window-header {
  background: linear-gradient(110deg, #294759, #263847);
  color: #f4f8fa;
  box-shadow: inset 0 -1px #99dddf3d;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding-inline: 12px;
  font-size: 14px;
  font-weight: 650;

  &.is-draggable {
    cursor: move;
    touch-action: none;
  }
}

.header-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.header-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  min-width: 0;
  max-width: calc(100% - 48px);
}

.header-action {
  display: grid;
  place-items: center;
  width: var(--header-height);
  min-width: 0;
  flex-shrink: 1;
  color: inherit;
  touch-action: manipulation;

  &:hover,
  &:active {
    background: #ffffff20;
    color: white;
  }

  &.close-action:hover {
    background: var(--el-color-danger);
  }
}

button svg {
  width: 18px;
  height: 18px;
  max-width: 100%;
}

button:focus-visible,
.header-title:focus-visible,
.window-actions:focus-visible {
  outline: 2px solid #7ff5fe;
  outline-offset: -2px;
}

.window-content {
  flex: 1 1 0;
  min-height: 0;
  background: var(--el-bg-color);
  overflow: auto;
  border-radius: 0 0 6px 6px;
}

.window-popups {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;

  & :deep(.el-popper) {
    pointer-events: auto;
  }
}

.window-actions {
  position: absolute;
  right: 0;
  top: var(--header-height);
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 100%;
  padding: 6px;
  border-radius: 4px;
  background: #263240;
  color: white;
  font-size: 12px;

  &.above {
    top: auto;
    bottom: 100%;
  }

  button {
    min-width: 44px;
    min-height: 44px;
    padding: 4px;
    border-radius: 4px;
    background: #465464;
    touch-action: manipulation;
  }
}

.direction-buttons {
  display: flex;
  gap: 4px;

  button {
    display: grid;
    place-items: center;
  }
}
</style>
