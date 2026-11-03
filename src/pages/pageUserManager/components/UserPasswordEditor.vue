<script setup lang="ts">
import type { SysUserPasswordUpdateVo } from '@/api/alova/globals'
import type { ElFormType } from '@/shared'
import type { ItemFormRules } from '@/utils'
import { Check } from '@element-plus/icons-vue'
import { ref } from 'vue'
import { emptyCheck, lengthCheck } from '../utils/formRules'

defineProps<{
  loading: boolean
}>()

const emits = defineEmits<{
  submit: []
}>()

const modelValue = defineModel<SysUserPasswordUpdateVo>('modelValue', {
  required: true,
})

const rules: ItemFormRules<{ password: string }> = {
  password: [lengthCheck('密码', 6), emptyCheck()],
}

const formRef = ref<ElFormType | null>(null)

const submit = async () => {
  try {
    await formRef.value?.validate()
    emits('submit')
  } catch {
    // validate, no error
  }
}
</script>

<template>
  <div>
    <el-form ref="formRef" label-width="100px" :model="modelValue" :rules="rules">
      <el-form-item prop="password" label="新密码">
        <el-input v-model="modelValue.password" type="password" clearable />
      </el-form-item>
    </el-form>

    <div class="flex justify-end">
      <el-button :icon="Check" type="primary" :loading="loading" @click="submit"> 确认 </el-button>
    </div>
  </div>
</template>
