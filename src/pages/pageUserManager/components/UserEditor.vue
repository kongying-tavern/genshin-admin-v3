<script lang="ts" setup>
import type { UnwrapRef } from 'vue'
import type { SysRoleVo, SysUserVo } from '@/api/alova/globals'
import type { ElFormType } from '@/shared'
import type { ItemFormRules } from '@/utils'
import { Check, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { WinDialog, WinDialogFooter, WinDialogTabPanel, WinDialogTitleBar } from '@/components'
import { useFetchHook } from '@/hooks'

const props = defineProps<{
  data: SysUserVo
  roleList: SysRoleVo[]
}>()

const emits = defineEmits<{
  success: []
  close: []
}>()

const roleOptions = computed(() =>
  props.roleList.map(role => ({
    label: role.name,
    value: role.id,
  })),
)

const formRef = ref<ElFormType | null>(null)
const formData = ref({
  userId: props.data.id,
  nickname: props.data.nickname,
  qq: props.data.qq,
  phone: props.data.phone,
  logo: props.data.logo,
  roleId: props.data.roleId,
})

const rules: ItemFormRules<UnwrapRef<typeof formData>> = {
  roleId: [{ required: true, message: '必须指定一个角色' }],
}

const {
  loading,
  refresh: submit,
  onSuccess,
  onError,
} = useFetchHook({
  onRequest: () => Apis.user.updateUser({ data: formData.value }),
})

onSuccess(() => {
  ElMessage.success({
    message: '编辑成功',
  })
  emits('close')
  emits('success')
})

onError(err =>
  ElMessage.error({
    message: `更新用户信息失败，原因为：${err.message}`,
  }),
)

const editUser = async () => {
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
      编辑用户 {{ data.username }}
    </WinDialogTitleBar>

    <WinDialogTabPanel>
      <el-form ref="formRef" v-bind="$attrs" label-width="60px" :model="formData" :rules="rules">
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="formData.nickname" placeholder="请输入昵称" />
        </el-form-item>

        <el-form-item label="Q号" prop="qq">
          <el-input v-model="formData.qq" placeholder="请输入Q号" />
        </el-form-item>

        <el-form-item label="手机号" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入手机号" />
        </el-form-item>

        <el-form-item label="角色" prop="roleId">
          <el-select-v2 v-model="formData.roleId" :options="roleOptions" />
        </el-form-item>

        <el-form-item label="头像" prop="logo">
          <div
            class="w-20 h-20 border rounded overflow-hidden"
            style="
              border-color: var(--el-color-primary-light-8);
              background-color: var(--el-color-primary-light-9);
            "
          >
            <img
              v-if="formData.logo"
              :src="formData.logo"
              class="w-full h-full object-contain"
              referrerpolicy="no-referrer"
            />
          </div>
          <div class="pl-2">功能开发中</div>
        </el-form-item>
      </el-form>
    </WinDialogTabPanel>

    <WinDialogFooter>
      <el-button :icon="Check" type="primary" :loading="loading" @click="editUser">
        确认
      </el-button>
      <el-button :icon="Close" :disabled="loading" @click="() => emits('close')"> 取消 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
