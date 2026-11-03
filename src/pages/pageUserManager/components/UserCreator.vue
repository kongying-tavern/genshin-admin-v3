<script lang="ts" setup>
import type { SysUserRegisterVo } from '@/api/alova/globals'
import type { ElFormType } from '@/shared'
import type { ItemFormRules } from '@/utils'
import { Check, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { WinDialog, WinDialogFooter, WinDialogTabPanel, WinDialogTitleBar } from '@/components'
import { useFetchHook } from '@/hooks'

const emits = defineEmits<{
  success: []
  close: []
}>()

type UserRegisterVo = Required<
  SysUserRegisterVo & {
    confirmPassword?: string
  }
>

const formData = ref<UserRegisterVo>({
  username: '',
  password: '',
  confirmPassword: '',
})

const formRef = ref<ElFormType | null>(null)
const rules: ItemFormRules<UserRegisterVo> = {
  username: [
    {
      required: true,
      message: '用户名至少需要6个字符',
      validator: (_, v: string) => /\S{6}/.test(v),
    },
  ],
  password: [
    {
      required: true,
      message: '密码至少需要6个字符',
      validator: (_, v: string) => /\S{6}/.test(v),
    },
  ],
  confirmPassword: [
    {
      required: true,
      message: '密码至少需要6个字符',
      validator: (_, v: string) => /\S{6}/.test(v),
    },
    {
      required: true,
      message: '两次填写的密码不一致',
      validator: (_, v: string) => v === formData.value.password,
    },
  ],
}

const {
  loading,
  refresh: submit,
  onSuccess,
  onError,
} = useFetchHook({
  onRequest: async () => {
    const { username, password } = formData.value
    await Apis.user.registerUser({
      data: { username, password },
    })
  },
})

const createUser = async () => {
  try {
    await formRef.value?.validate()
    await submit()
  } catch {
    // inValid form, no error
  }
}

onSuccess(() => {
  ElMessage.success({
    message: '添加成功',
  })
  emits('close')
  emits('success')
})

onError(err =>
  ElMessage.error({
    message: `添加用户失败，原因为：${err.message}`,
  }),
)
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar :loading="loading" @close="emits('close')"> 添加用户 </WinDialogTitleBar>

    <WinDialogTabPanel>
      <el-form ref="formRef" v-bind="$attrs" label-width="100px" :model="formData" :rules="rules">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="formData.username" placeholder="请输入用户名或Q号" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input v-model="formData.password" placeholder="请输入密码" />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="formData.confirmPassword" placeholder="请再次输入密码" />
        </el-form-item>
      </el-form>
    </WinDialogTabPanel>

    <WinDialogFooter>
      <el-button :icon="Check" type="primary" :loading="loading" @click="createUser">
        确认
      </el-button>
      <el-button :icon="Close" :disabled="loading" @click="emits('close')"> 取消 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
