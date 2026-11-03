<script setup lang="ts">
import type { SysUserInvitationVo } from '@/api/alova/globals'
import { Check, Close, Delete } from '@element-plus/icons-vue'
import { WinDialog, WinDialogFooter, WinDialogTitleBar } from '@/components'
import { useInvitationDelete } from '../hooks'

const props = defineProps<{
  data: SysUserInvitationVo
}>()

const emits = defineEmits<{
  success: []
  close: [boolean]
}>()

const { loading, refresh: submit, onSuccess } = useInvitationDelete()
onSuccess(() => emits('success'))

const cancel = () => {
  emits('close', false)
}

const confirm = async () => {
  await submit(props.data)
  emits('close', true)
}
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar :loading="loading" @close="cancel"> 删除邀请码 </WinDialogTitleBar>

    <div class="w-[300px] p-2 grid grid-rows-[auto_1fr] grid-cols-[auto_1fr] gap-2">
      <div class="row-span-2">
        <el-icon class="p-1" size="40" color="var(--el-color-danger)">
          <Delete />
        </el-icon>
      </div>
      <div>确实要永久性的删除此邀请码吗？</div>
      <div class="text-[var(--el-text-color-primary)]">
        <div class="flex">
          <div class="w-[60px]">ID</div>
          <div class="font-mono">
            {{ data.id }}
          </div>
        </div>
        <div class="flex">
          <div class="w-[60px]">用户名</div>
          <div class="font-mono">
            {{ data.username }}
          </div>
        </div>
      </div>
    </div>

    <WinDialogFooter>
      <el-button :icon="Check" :loading="loading" type="danger" @click="confirm"> 是 </el-button>

      <el-button :icon="Close" :disabled="loading" @click="cancel"> 否 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
