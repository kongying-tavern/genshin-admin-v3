<script setup lang="ts">
import { User } from '@element-plus/icons-vue'
import { registerForm } from '@/ai/bindings'
import { WinDialog, WinDialogTitleBar } from '@/components/WinUI'
import { useCountDown } from '@/hooks'
import { useUserStore } from '@/stores'
import { useLoginForm } from '../hooks'

const emits = defineEmits<{
  success: []
  close: []
}>()

const isRegister = defineModel<boolean>('isRegister', {
  required: true,
})

const title = import.meta.env.VITE_TITLE

const { formRef, isValid, rules, loginForm, loading, login, onSuccess, onError, handleValidate } =
  useLoginForm()

onSuccess(() => {
  emits('close')
  emits('success')
})

const userStore = useUserStore()
let unbindForm: (() => void) | undefined

const bindLoginForm = () => {
  unbindForm?.()
  unbindForm = registerForm({
    id: 'login',
    title: '登录',
    description: '登录表单；通过 forms.get/set/validate/submit 驱动（不支持 close）',
    sensitiveFields: ['password'],
    fields: [
      { key: 'username', label: '用户名', type: 'string', required: true },
      { key: 'password', label: '密码', type: 'string', required: true, secret: true },
    ],
    getValues: () => ({
      username: loginForm.value.username,
      passwordSet: Boolean(loginForm.value.password),
    }),
    setValues: patch => {
      if (typeof patch.username === 'string') loginForm.value.username = patch.username
      if (typeof patch.password === 'string') loginForm.value.password = patch.password
    },
    validate: async () => {
      await formRef.value?.validate()
    },
    submit: () => login(),
    isBusy: () => loading.value,
    events: {
      onSuccess: callback => onSuccess(() => callback()),
      onError: callback => onError(error => callback(error)),
    },
  })
}

// 登录弹窗只在不登录时可见；登录后立即注销表单句柄，退出后重新注册
watch(
  () => userStore.isLogin,
  isLogin => {
    if (isLogin) {
      unbindForm?.()
      unbindForm = undefined
      return
    }
    bindLoginForm()
  },
  { immediate: true },
)

onUnmounted(() => {
  unbindForm?.()
})

const { count, set: setCount } = useCountDown()

const trigger = async () => {
  if (count.value > 0) return
  setCount(3)
  await login()
}
</script>

<template>
  <WinDialog class="w-[340px]">
    <WinDialogTitleBar :loading="loading" @close="() => emits('close')"> 登录 </WinDialogTitleBar>

    <div
      class="w-full flex flex-col p-4 bg-[var(--el-bg-color)]"
      style="--el-border-radius-base: 8px"
    >
      <div class="flex flex-col justify-center items-center font-genshin pb-4">
        <img class="w-12 h-12" src="/favicon.png" />
        {{ title }}
      </div>

      <el-form
        ref="formRef"
        label-width="70px"
        label-position="left"
        :model="loginForm"
        :rules="rules"
        size="large"
        class="user-form"
        @validate="handleValidate"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入用户名或Q号" type="text" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="loginForm.password"
            placeholder="请输入密码"
            type="password"
            show-password
          />
        </el-form-item>

        <div class="flex">
          <el-button
            type="primary"
            class="w-full"
            size="large"
            :icon="User"
            :disabled="!isValid || count > 0"
            :loading="loading"
            @click="trigger"
          >
            登录 {{ count > 0 ? `(${count})` : '' }}
          </el-button>
        </div>
      </el-form>

      <el-divider style="margin: 24px 0 16px" />

      <div class="flex justify-between">
        <el-button link type="primary" disabled title="暂时没做这个功能"> 忘记密码 </el-button>
        <el-button link type="success" :disabled="loading" @click="isRegister = true">
          没有账号？去注册 →
        </el-button>
      </div>
    </div>
  </WinDialog>
</template>

<style scoped>
.user-form {
  :deep(.el-form-item) {
    label {
      font-size: 12px;
    }
  }
}
</style>
