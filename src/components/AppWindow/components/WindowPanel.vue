<script setup lang="ts">
import type { MapWindow } from '../types'
import * as ElIcons from '@element-plus/icons-vue'
import { vTransition } from '@/directives'
import { useAppWindow } from '../hooks'
import WindowResizer from './WindowResizer.vue'

const props = defineProps<{
  id: string
  dragHookId: string
}>()

const emits = defineEmits<{
  optimizeWindowPosition: []
}>()

const context = useAppWindow()

const info = defineModel<MapWindow.Info>('info', {
  required: true,
})

// @ts-expect-error 模板 `ref="mainRef"` 在运行时写入该 ref，脚本侧不读取
const mainRef = defineModel<HTMLElement | null>('mainRef', {
  default: null,
})

const isTransitioning = ref(false)

const isMinimize = computed(() => info.value.sizeState === 'minimize')

const isMaximize = computed(() => info.value.sizeState === 'maximize')

const handleResize = (resizeProps: MapWindow.ResizeProps) => {
  context.resize(props.id, resizeProps)
}

const handleResizeStart = () => {
  context.setInteractionState(props.id, 'manual')
}

const handleResizeEnd = () => {
  context.setInteractionState(props.id, 'default')
  emits('optimizeWindowPosition')
}

const isResizerEnable = computed(() => {
  if (isTransitioning.value || isMaximize.value || isMinimize.value || !context.getWindow(props.id))
    return false
  return true
})
</script>

<template>
  <div
    v-transition:height="isTransitioning"
    class="window-instance"
    :class="{
      'is-top': context.isTop(id),
      'is-minimize': isMinimize,
      'is-maximize': isMaximize,
      'is-manual': info.interactionState === 'manual',
      'is-transitioning': isTransitioning,
      'use-transition': context.transitionId === id,
    }"
    :style="{
      '--w': info.size.width,
      '--h': info.size.height,
      '--tx': info.translate.x,
      '--ty': info.translate.y,
    }"
    :[`data-${dragHookId}`]="id"
  >
    <div class="window-header" :class="{ 'is-minimize': isMinimize }">
      <div class="header-title" data-draggable="true">
        {{ info.name }}
      </div>

      <div class="header-action flex-shrink-0">
        <el-icon
          :size="30"
          class="header-action-button"
          style="--hover-color: #ffffff20; --active-color: #ffffff40"
          @click="() => context.setSizeState(id, 'minimize')"
        >
          <ElIcons.Plus v-if="isMinimize" />
          <ElIcons.Minus v-else />
        </el-icon>

        <el-icon
          :size="30"
          class="header-action-button"
          style="--hover-color: #ffffff20; --active-color: #ffffff40"
          @click="() => context.setSizeState(id, 'maximize')"
        >
          <ElIcons.CopyDocument v-if="isMaximize" />
          <ElIcons.FullScreen v-else />
        </el-icon>

        <el-icon
          :size="30"
          class="header-action-button"
          style="
            --hover-color: var(--el-color-danger);
            --active-color: var(--el-color-danger-light-3);
          "
          @click="() => context.closeWindow(id)"
        >
          <ElIcons.Close />
        </el-icon>
      </div>
    </div>

    <div ref="mainRef" class="window-content" />

    <WindowResizer
      v-if="isResizerEnable"
      :size="context.getWindow(id)!.size"
      :translate="context.getWindow(id)!.translate"
      @resize="handleResize"
      @resize-start="handleResizeStart"
      @resize-end="handleResizeEnd"
    />
  </div>
</template>

<style scoped>
.window-instance {
  width: calc(var(--w, 400) * 1px);
  height: calc(var(--h, 400) * 1px);
  border-radius: 6px;
  pointer-events: auto;
  position: absolute;
  left: 0;
  top: 0;
  translate: calc(var(--tx) * 1px) calc(var(--ty) * 1px);
  display: flex;
  flex-direction: column;
  z-index: v-bind('info.order');
  outline: 1px solid color-mix(in srgb, var(--el-border-color-darker) 50%, transparent 50%);
  transition-property: width, height, translate;
  transition-duration: 200ms;
  transition-timing-function: ease;
  @apply shadow-sm;

  &.use-transition {
    view-transition-name: window-instance;
  }

  &.is-manual {
    transition: none;
    will-change: transform;
  }

  &.is-minimize {
    width: 300px;
    height: 30px;
    &.window-content {
      display: none;
    }
  }

  &.is-maximize {
    translate: 0 0;
    width: 100dvw;
    height: 100dvh;
  }

  &.is-transitioning {
    background: #263240;
  }

  &.is-top {
    @apply shadow-2xl;
  }
}

.window-header {
  height: calc(v-bind('context.HEADER_HEIGHT') * 1px);
  flex-shrink: 0;
  background: #263240;
  overflow: hidden;
  user-select: none;
  border-radius: 6px 6px 0 0;
  display: flex;
  justify-content: space-between;
  &.is-minimize {
    border-radius: 6px;
  }
}

.header-title {
  @apply px-2 flex-1
    text-xs text-[#C6C2BA] font-bold leading-[30px]
    overflow-hidden whitespace-nowrap text-ellipsis;
  cursor: move;
}

.header-action-button {
  @apply p-2
    transition-all
    text-[var(--el-color-white)]
    hover:bg-[var(--hover-color)]
    hover:text-[var(--el-color-white)]
    active:bg-[var(--active-color)];
}

.window-content {
  height: 100%;
  background: var(--el-bg-color);
  overflow: auto;
  border-radius: 0 0 6px 6px;
}
</style>
