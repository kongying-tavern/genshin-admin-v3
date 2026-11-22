<script setup lang="ts">
import { mapContainerKey } from '@/shared'
import { useUserStore } from '@/stores/user'
import { WindowPanel } from './components'
import WindowTaskbar from './components/WindowTaskbar.vue'
import { useAppWindow } from './hooks'
import { useWindowWorkspace } from './hooks/windowWorkspace'

const context = useAppWindow()
const workspace = useWindowWorkspace()
const userStore = useUserStore()
const container = inject(mapContainerKey)

// DOM 按创建顺序排列。激活只修改 z-index，避免移动已加载的 iframe。
const panels = computed(() =>
  context.panels.value.toSorted((a, b) => a.info.generation - b.info.generation),
)
const minimized = computed(() =>
  panels.value
    .filter(({ info }) => info.sizeState === 'minimize' && context.isOpen(info.id))
    .map(({ info }) => info),
)

onMounted(() => {
  const element = container?.value
  if (element)
    context.setWorkspaceSize({ width: element.clientWidth, height: element.clientHeight })
})

useResizeObserver(container, ([entry]) => {
  if (entry) context.setWorkspaceSize(entry.contentRect)
})

watch(panels, async entries => {
  await nextTick()
  for (const { info } of entries) {
    if (!workspace.get(info)) context.failMount(info)
  }
})

useEventListener(window, 'blur', workspace.onWindowBlur)
useEventListener(document, 'pointerdown', workspace.onPointerDown, { capture: true })
useEventListener(document, 'focusin', workspace.onFocusIn)
useEventListener(document, 'keydown', event => {
  if (event.key === 'Escape' && !event.defaultPrevented && workspace.cancelOperation()) {
    event.preventDefault()
  }
})

userStore.onBeforeLogout(() => context.clearWindow('logout'))
watch(
  () => userStore.auth.userId,
  (id, previous) => {
    if (id !== undefined && previous !== undefined && id !== previous) context.clearWindow('logout')
  },
  { flush: 'sync' },
)

onBeforeUnmount(() => {
  workspace.cancelOperation()
  context.clearWindow('workspace')
})
</script>

<template>
  <div
    class="map-window-manager"
    :class="{ 'has-pointer-operation': workspace.pointerActive.value }"
  >
    <div class="window-panels">
      <WindowPanel
        v-for="{ info, order } in panels"
        :key="info.generation"
        :info="info"
        :order="order"
      />
    </div>
    <WindowTaskbar :windows="minimized" />
  </div>
</template>

<style scoped>
.map-window-manager {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: var(--map-window-layer, 11);
}

.window-panels {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.has-pointer-operation :deep(iframe) {
  pointer-events: none;
}
</style>
