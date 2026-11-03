<script setup lang="ts">
import WinDialogTabs from './WinDialogTabs.vue'

defineProps<{
  tabs?: { key: string; name: string }[]
  tabsDisabled?: boolean
}>()

const tabKey = defineModel<string>('tabKey', {
  required: false,
  default: undefined,
})
</script>

<template>
  <WinDialogTabs v-if="tabs?.length" v-model="tabKey" :options="tabs" :disabled="tabsDisabled" />

  <div
    v-bind="$attrs"
    class="win-dialog-tab-panel m-2 rounded"
    :class="tabs ? 'rounded-t-none mt-0' : ''"
  >
    <slot name="default" />
  </div>
</template>

<style scoped>
.win-dialog-tab-panel {
  @apply p-2 overflow-hidden
    border border-[var(--el-border-color)]
    bg-[var(--el-fill-color-blank)];
}
</style>
