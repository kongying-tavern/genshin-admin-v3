<script setup lang="ts">
import type { IconVo } from '@/api/alova/globals'
import { Check, Close } from '@element-plus/icons-vue'
import { IconRenderer, WinDialog, WinDialogFooter, WinDialogTitleBar } from '@/components'
import { useIconDelete } from '../hooks'

const props = defineProps<{
  title: string
  icon: IconVo
}>()

const emits = defineEmits<{
  success: [IconVo]
  close: [boolean]
}>()

const { loading, deleteIcon, onSuccess } = useIconDelete()

onSuccess(form => emits('success', form))

const cancel = () => {
  emits('close', false)
}

const confirm = async () => {
  await deleteIcon(props.icon)
  emits('close', true)
}
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar :loading="loading" @close="cancel">
      {{ title }}
    </WinDialogTitleBar>

    <div class="w-[300px] p-2 grid grid-rows-[auto_1fr] grid-cols-[auto_1fr] gap-2">
      <div class="row-span-2 w-[40px]">
        <IconRenderer class="w-[40px] h-[40px]" :icon-id="props.icon.id" />
      </div>
      <div>确实要永久性的删除此图标吗？</div>
      <div class="text-[var(--el-text-color-primary)]">
        <div>ID: {{ icon.id }}</div>
        <div>名称: {{ icon.tag }}</div>
      </div>
    </div>

    <WinDialogFooter>
      <el-button :icon="Check" :loading="loading" type="danger" @click="confirm"> 是 </el-button>

      <el-button :icon="Close" :disabled="loading" @click="cancel"> 否 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
