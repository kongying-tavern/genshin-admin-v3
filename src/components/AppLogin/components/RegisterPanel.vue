<script setup lang="ts">
import { CirclePlus } from '@element-plus/icons-vue'
import { WinDialog, WinDialogTitleBar } from '@/components/WinUI'
import { useCountDown } from '@/hooks'
import { useRegisterForm } from '../hooks'

const props = defineProps<{
  code?: string
  username?: string
}>()

const emits = defineEmits<{
  success: []
  close: []
}>()

const isRegister = defineModel<boolean>('isRegister', {
  required: true,
})

const title = import.meta.env.VITE_TITLE

const {
  // @ts-expect-error 模板 `ref="formRef"` 在运行时写入该 ref，脚本侧不读取
  formRef,
  isValid,
  rules,
  form,
  loading,
  register,
  onSuccess,
  handleValidate,
} = useRegisterForm({
  code: props.code,
  username: props.username,
})

onSuccess(() => {
  emits('close')
  emits('success')
})

const { count, set: setCount } = useCountDown()

const trigger = async () => {
  if (count.value > 0) return
  setCount(3)
  await register()
}
</script>

<template>
  <WinDialog class="w-[340px]">
    <WinDialogTitleBar :loading="loading" @close="() => emits('close')"> 注册 </WinDialogTitleBar>

    <div
      class="w-full flex flex-col p-4 bg-[var(--el-bg-color)]"
      style="--el-border-radius-base: 8px"
    >
      <div class="flex flex-col justify-center items-center font-['HYWenHei-85W'] pb-4">
        <img class="w-12 h-12" src="/favicon.ico" />
        {{ title }}
      </div>

      <el-form
        ref="formRef"
        label-width="70px"
        label-position="left"
        :model="form"
        :rules="rules"
        size="large"
        class="user-form"
        @validate="handleValidate"
      >
        <el-form-item label="邀请码" prop="code">
          <el-input v-model="form.code" placeholder="请输入注册邀请码" type="text" />
        </el-form-item>

        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名或Q号" type="text" />
        </el-form-item>

        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" type="text" />
        </el-form-item>

        <el-divider />

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            placeholder="请输入密码"
            type="password"
            show-password
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="repeatPassword">
          <el-input
            v-model="form.repeatPassword"
            placeholder="请输入密码"
            type="password"
            show-password
          />
        </el-form-item>

        <div class="flex">
          <el-button
            type="success"
            class="w-full"
            size="large"
            :icon="CirclePlus"
            :disabled="!isValid || count > 0"
            :loading="loading"
            @click="trigger"
          >
            注册 {{ count > 0 ? `(${count})` : '' }}
          </el-button>
        </div>
      </el-form>

      <el-divider style="margin: 24px 0 16px" />

      <div class="flex justify-between">
        <el-button link type="primary" :disabled="loading" @click="isRegister = false">
          ← 去登录
        </el-button>
      </div>
    </div>
  </WinDialog>
</template>

<style scoped>
.user-form {
  :deep(.el-form-item) {
    label {
      user-select: none;
      font-size: 12px;
    }
  }
}
</style>
