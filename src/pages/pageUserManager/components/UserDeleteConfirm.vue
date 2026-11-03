<script setup lang="ts">
import type { SysUserVo } from '@/api/alova/globals'
import { Check, Close } from '@element-plus/icons-vue'
import { WinDialog, WinDialogFooter, WinDialogTitleBar } from '@/components'
import { useUserDelete } from '../hooks'

const props = defineProps<{
  data: SysUserVo
}>()

const emits = defineEmits<{
  success: []
}>()

const action = defineModel<string>('action', {
  required: false,
  default: '',
})

const { loading, submit, onSuccess } = useUserDelete(computed(() => props.data))

onSuccess(() => {
  action.value = ''
  emits('success')
})
</script>

<template>
  <el-dialog
    class="custom-dialog hidden-header"
    align-center
    append-to-body
    width="fit-content"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    :model-value="action === 'delete'"
    :style="{
      '--el-dialog-border-radius': '8px',
      '--el-dialog-padding-primary': '0',
      '--el-dialog-width': 'auto',
    }"
  >
    <WinDialog>
      <WinDialogTitleBar :loading="loading" @close="action = ''"> 删除用户 </WinDialogTitleBar>

      <div class="w-[300px] p-2 grid grid-rows-[auto_1fr] grid-cols-[auto_1fr] gap-2">
        <div class="row-span-2">
          <el-icon class="p-1" size="40" color="var(--el-color-danger)">
            <Delete />
          </el-icon>
        </div>
        <div>确实要永久性的删除此用户吗？</div>
        <div class="text-[var(--el-text-color-primary)]">
          <div>UID: {{ data.id }}</div>
          <div>账号: {{ data.username }}</div>
        </div>
      </div>

      <WinDialogFooter>
        <el-button :icon="Check" :loading="loading" type="danger" @click="submit"> 是 </el-button>

        <el-button :icon="Close" :disabled="loading" @click="action = ''"> 否 </el-button>
      </WinDialogFooter>
    </WinDialog>
  </el-dialog>
</template>
