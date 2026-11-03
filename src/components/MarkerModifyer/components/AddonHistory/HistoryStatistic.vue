<script setup lang="ts">
import type { HistoryVo, SysUserSmallVo } from '@/api/alova/globals'
import { ElDialog } from 'element-plus'
import { WinDialog, WinDialogTabPanel, WinDialogTitleBar } from '@/components'
import { useHistoryChart } from './hooks'

const props = defineProps<{
  record: (HistoryVo & { diffs: Set<string> })[]
  users: Map<string, SysUserSmallVo>
}>()

const visible = defineModel<boolean>('visible', {
  required: true,
})

const containerRef = ref<HTMLElement>()
useHistoryChart(containerRef, {
  data: computed(() => props.record),
  users: computed(() => props.users),
})
</script>

<template>
  <ElDialog
    v-model="visible"
    class="hidden-header bg-transparent"
    width="fit-content"
    align-center
    destroy-on-close
    append-to-body
    :style="{
      '--el-dialog-border-radius': '8px',
      '--el-dialog-padding-primary': '0',
    }"
  >
    <WinDialog>
      <WinDialogTitleBar @close="visible = false"> 历史记录统计图表 </WinDialogTitleBar>

      <WinDialogTabPanel class="w-[512px] h-[384px] mb-2 flex flex-col overflow-hidden">
        <div ref="containerRef" class="flex-1 w-full" />
      </WinDialogTabPanel>
    </WinDialog>
  </ElDialog>
</template>

<style>
.hidden-header {
  .el-dialog__header {
    display: none;
  }
}
</style>
