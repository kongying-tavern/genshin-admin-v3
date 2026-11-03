<script lang="ts" setup>
import type { TypeManager, TypeObject } from '../config'
import { Check, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { WinDialog, WinDialogFooter, WinDialogTabPanel, WinDialogTitleBar } from '@/components'
import { useFetchHook } from '@/hooks'
import { TypeDetailForm } from '.'

const props = defineProps<{
  parent?: TypeObject
  manager: TypeManager<TypeObject>
}>()

const emits = defineEmits<{
  success: []
  close: []
}>()

const formRef = ref<InstanceType<typeof TypeDetailForm> | null>(null)

const form = ref<TypeObject>({
  parent: props.parent?.id,
})

const {
  loading,
  refresh: submit,
  onSuccess,
  onError,
} = useFetchHook({
  onRequest: () => props.manager.create(form.value, props.parent),
})

onSuccess(() => {
  ElMessage.success({
    message: `添加${props.manager.info.label}成功`,
  })
  emits('close')
  emits('success')
})

onError(err =>
  ElMessage.error({
    message: `添加${props.manager.info.label}失败，原因为：${err.message}`,
  }),
)

const createType = async () => {
  try {
    await formRef.value?.validate()
    await submit()
  } catch {
    // validate, no error
  }
}
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar :loading="loading" @close="() => emits('close')">
      新增 {{ manager.info.label }}
    </WinDialogTitleBar>

    <WinDialogTabPanel>
      <TypeDetailForm v-model="form" :parent="parent" :manager="manager" />
    </WinDialogTabPanel>

    <WinDialogFooter>
      <el-button type="primary" :icon="Check" :loading="loading" @click="createType">
        新增
      </el-button>

      <el-button :disabled="loading" :icon="Close" @click="() => emits('close')"> 取消 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
