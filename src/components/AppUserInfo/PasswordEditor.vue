<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus'
import { GSButton, GSInput } from '@/components'
import { useFetchHook } from '@/hooks'
import { useUserStore } from '@/stores'

const userStore = useUserStore()

const form = ref({
  oldPassword: '',
  password: '',
  repeat: '',
})

watch(
  form,
  data => {
    for (const key in data) {
      // 只允许 ASCII 非空白字符
      const v = data[key as keyof typeof data].replace(/[^\x21-\x7F]/g, '')
      if (form.value[key as keyof typeof data] !== v) form.value[key as keyof typeof data] = v
    }
  },
  { deep: true },
)

const rules: FormRules = {
  oldPassword: [
    { required: true, message: '密码不能小于6个字符', validator: (_, v) => /\S{6}/.test(v) },
  ],
  password: [
    { required: true, message: '密码不能小于6个字符', validator: (_, v) => /\S{6}/.test(v) },
  ],
  repeat: [
    { required: true, message: '密码不能小于6个字符', validator: (_, v) => /\S{6}/.test(v) },
    { message: '两次输入的密码不一致', validator: (_, v) => v === form.value.password },
  ],
}

const formRef = ref<FormInstance>()

const {
  loading,
  refresh: updatePassword,
  onSuccess,
} = useFetchHook({
  onRequest: async () => {
    if (!userStore.info?.id) throw new Error('用户 id 为空')

    const isValid = await formRef.value?.validate().catch(() => false)
    if (!isValid) throw new Error('校验失败')

    const { id: userId } = userStore.info
    if (userId === undefined) throw new Error('用户 id 为空')

    const { oldPassword, password } = form.value
    await Apis.user.updateUserPassword({
      data: {
        userId: userStore.info.id,
        oldPassword,
        password,
      },
    })
  },
})

onSuccess(() => {
  userStore.logout()
})
</script>

<template>
  <div class="flex flex-col justify-center items-center">
    <el-form
      ref="formRef"
      style="--el-form-label-font-size: 18px; width: 370px; --el-text-color-regular: #424f65"
      label-width="100px"
      label-position="left"
      :model="form"
      :rules="rules"
    >
      <el-form-item label="旧密码" prop="oldPassword">
        <GSInput v-model="form.oldPassword" type="password" style="width: 100%" />
      </el-form-item>
      <el-form-item label="新密码" prop="password">
        <GSInput v-model="form.password" type="password" style="width: 100%" />
      </el-form-item>
      <el-form-item label="确认密码" prop="repeat">
        <GSInput v-model="form.repeat" type="password" style="width: 100%" />
      </el-form-item>
    </el-form>

    <GSButton
      icon="submit"
      theme="dark"
      style="width: 370px"
      :loading="loading"
      @click="updatePassword"
    >
      修改密码
    </GSButton>
  </div>
</template>
