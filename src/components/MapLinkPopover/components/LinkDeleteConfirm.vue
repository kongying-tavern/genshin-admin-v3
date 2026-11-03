<script setup lang="ts">
import type { MarkerLinkageVo } from '@/api/alova/globals'
import { Check, Close, Delete } from '@element-plus/icons-vue'
import { WinDialog, WinDialogFooter, WinDialogTitleBar } from '@/components'
import { useLinkDelete } from '../hooks'

const props = defineProps<{
  link: MarkerLinkageVo
}>()

const emits = defineEmits<{
  success: []
  close: [boolean]
}>()

const { loading, refresh: commit, onSuccess } = useLinkDelete()

onSuccess(() => {
  emits('success')
})

const cancel = () => {
  emits('close', false)
}

const confirm = async () => {
  await commit(props.link)
  emits('close', true)
}
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar :loading="loading" @close="cancel"> 删除关联 </WinDialogTitleBar>

    <div class="w-[300px] p-2 grid grid-rows-[auto_1fr] grid-cols-[auto_1fr] gap-2">
      <div class="row-span-2">
        <el-icon class="p-1" size="40" color="var(--el-color-danger)">
          <Delete />
        </el-icon>
      </div>
      <div>确实要从组中删除此关联吗？</div>
      <div class="text-[var(--el-text-color-primary)]">
        <div>分组 ID: {{ link.groupId?.slice(-8).toUpperCase() }}</div>
        <div>连线 ID: {{ link.id }}</div>
      </div>
    </div>

    <WinDialogFooter>
      <el-button :icon="Check" :loading="loading" type="danger" @click="confirm"> 是 </el-button>

      <el-button :icon="Close" :disabled="loading" @click="cancel"> 否 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
