<script lang="ts" setup>
import { Check, Close } from '@element-plus/icons-vue'
import { WinDialog, WinDialogFooter, WinDialogTabPanel, WinDialogTitleBar } from '@/components'
import { ItemDetailForm } from '.'
import { useItemCreate } from '../hooks'

const emits = defineEmits<{
  success: []
  close: []
}>()

const detailFormRef = useTemplateRef('detailFormRef')
const { formData, loading, handleSubmit, onSuccess } = useItemCreate(detailFormRef)

onSuccess(() => {
  emits('close')
  emits('success')
})
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar :loading="loading" @close="() => emits('close')">
      新建物品
    </WinDialogTitleBar>

    <WinDialogTabPanel>
      <ItemDetailForm ref="detailFormRef" v-model="formData" style="width: 540px" />
    </WinDialogTabPanel>

    <WinDialogFooter>
      <el-button :icon="Check" :loading="loading" type="primary" @click="handleSubmit">
        确认
      </el-button>
      <el-button :icon="Close" :disabled="loading" @click="() => emits('close')"> 取消 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
