<script setup lang="ts">
import { useCountDown } from '@/hooks'
import { useRegisterForm } from './hooks'

const title = import.meta.env.VITE_TITLE
// @ts-expect-error 模板 `ref="formRef"` 在运行时写入该 ref，脚本侧不读取
const { formRef, rules, registerForm, loading, register } = useRegisterForm()

const activeName = ref('basic')

const { count, set: setCount } = useCountDown()

const trigger = async () => {
  if (count.value > 0) return
  await register()
  setCount(2)
}
</script>

<template>
  <div class="h-full grid place-items-center">
    <el-card class="w-96 py-2" style="--el-card-border-radius: 8px">
      <div class="flex flex-col justify-center items-center font-['HYWenHei-85W'] pb-4">
        <img class="w-12 h-12" src="/favicon.ico" />
        {{ title }}
      </div>

      <div class="flex flex-col" style="--el-border-radius-base: 8px">
        <el-tabs v-model="activeName" class="demo-tabs">
          <el-tab-pane label="Q号注册" name="basic" class="pt-4">
            <el-form
              ref="formRef"
              label-width="70px"
              label-position="left"
              :model="registerForm"
              :rules="rules"
              class="pb-4"
              size="large"
            >
              <el-form-item label="Q号" prop="username">
                <el-input v-model="registerForm.username" placeholder="请输入Q号" type="text" />
              </el-form-item>
              <el-form-item label="密码" prop="password">
                <el-input
                  v-model="registerForm.password"
                  placeholder="请输入密码"
                  type="password"
                  show-password
                />
              </el-form-item>
            </el-form>
            <el-button
              type="primary"
              class="w-full"
              size="large"
              :disabled="count > 0"
              :loading="loading"
              @click="trigger"
            >
              注册 {{ count > 0 ? `(${count}s)` : '' }}
            </el-button>
          </el-tab-pane>
        </el-tabs>

        <el-divider />

        <div class="flex justify-end">
          <el-button link type="primary">
            <router-link to="/login"> 有账号了？去登录 → </router-link>
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>
