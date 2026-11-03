<script lang="ts" setup>
import type { TypeManager, TypeObject } from '../config'
import { Check, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { cloneDeep } from 'lodash'
import { WinDialog, WinDialogFooter, WinDialogTabPanel, WinDialogTitleBar } from '@/components'
import { useFetchHook } from '@/hooks'
import { TypeDetailForm } from '.'

const props = defineProps<{
  data: TypeObject
  parent?: TypeObject
  manager: TypeManager<TypeObject>
}>()

const emits = defineEmits<{
  success: []
  close: []
}>()

const formRef = ref<InstanceType<typeof TypeDetailForm> | null>(null)

const form = ref(cloneDeep(props.data))

const {
  loading,
  refresh: submit,
  onSuccess,
  onError,
} = useFetchHook({
  onRequest: () => props.manager.update(form.value),
})

onSuccess(() => {
  ElMessage.success({
    message: `编辑${props.manager.info.label}成功`,
  })
  emits('close')
  emits('success')
})

onError(err =>
  ElMessage.error({
    message: `编辑${props.manager.info.label}失败，原因为：${err.message}`,
  }),
)

const editType = async () => {
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
      编辑 {{ manager.info.label }}
    </WinDialogTitleBar>

    <WinDialogTabPanel>
      <TypeDetailForm v-model="form" :parent="parent" :manager="manager" />
    </WinDialogTabPanel>

    <WinDialogFooter>
      <el-button type="primary" :icon="Check" :loading="loading" @click="editType">
        保存
      </el-button>

      <el-button :disabled="loading" :icon="Close" @click="() => emits('close')"> 取消 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
