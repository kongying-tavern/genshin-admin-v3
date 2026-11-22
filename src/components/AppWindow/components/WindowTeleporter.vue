<script setup lang="ts">
import type { MapWindow } from '../types'
import { useAppWindow } from '../hooks'
import { useWindowWorkspace } from '../hooks/windowWorkspace'
import { windowPopupKey } from '../hooks/useWindowPopup'

const props = defineProps<{
  info?: MapWindow.Info
}>()

const context = useAppWindow()
const workspace = useWindowWorkspace()
const mounted = computed(() => props.info && workspace.get(props.info))

provide(windowPopupKey, {
  target: computed(() => mounted.value?.popups),
  bodyClass: computed(
    () => props.info && workspace.bodyPopupClass(props.info.id, props.info.generation),
  ),
  active: computed(() =>
    Boolean(
      props.info
      && props.info.id === context.activeId.value
      && props.info.sizeState !== 'minimize'
      && !workspace.isModal(),
    ),
  ),
})
</script>

<template>
  <Teleport v-if="mounted" :to="mounted.content">
    <slot />
  </Teleport>
</template>
