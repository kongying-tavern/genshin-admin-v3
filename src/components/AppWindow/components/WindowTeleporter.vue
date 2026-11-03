<script setup lang="ts">
import type { MapWindow } from '../types'
import { useAppWindow } from '../hooks'

const props = defineProps<{
  info?: MapWindow.Info
}>()

const emits = defineEmits<{
  close: []
}>()

const context = useAppWindow()

context.closeHook.on(id => {
  if (id !== props.info?.id) return
  emits('close')
})
</script>

<template>
  <Teleport v-if="info?.ref" :to="info.ref">
    <slot name="default" />
  </Teleport>
</template>
