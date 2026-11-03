<script setup lang="ts">
import type { ElForm, FormItemRule } from 'element-plus'
import type { RSysUserInvitationSmallVo, SysUserInvitationVo } from '@/api/alova/globals'
import * as ElIcons from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { WinDialog, WinDialogFooter, WinDialogTabPanel, WinDialogTitleBar } from '@/components'
import { GROUPED_ACCESS_POLICY_OPTIONS, RouteQuery } from '@/shared'
import { useUserStore } from '@/stores'
import { useInvitationCreate, useInvitationUpdate } from '../hooks'

const props = defineProps<{
  title: string
  data?: SysUserInvitationVo
}>()

const emits = defineEmits<{
  success: []
  close: [data?: RSysUserInvitationSmallVo]
}>()

const userStore = useUserStore()

const isUpdateMode = props.data?.code !== undefined

const formRef = shallowRef<InstanceType<typeof ElForm>>()

const raw = JSON.parse(JSON.stringify(props.data ?? {})) as SysUserInvitationVo

const form = ref<SysUserInvitationVo>({
  accessPolicy: ['ip:same_last_ip', 'dev:same_last_device'],
  username: '',
  remark: '',
  ...props.data,
})

const isSame = computed(() => {
  const { username, remark, roleId, accessPolicy = [] } = form.value
  return [
    username === raw.username,
    remark === raw.remark,
    roleId === raw.roleId,
    JSON.stringify(accessPolicy.toSorted()) === JSON.stringify((raw.accessPolicy ?? []).toSorted()),
  ].every(Boolean)
})

const {
  data: invitation,
  loading,
  refresh: submit,
  onSuccess,
} = (isUpdateMode ? useInvitationUpdate : useInvitationCreate)({
  form,
  validate: () => formRef.value?.validate().catch(() => false),
})

onSuccess(() => {
  emits('close', invitation.value)
  emits('success')
})

const rules: Partial<Record<keyof SysUserInvitationVo, FormItemRule>> = {
  username: {
    required: true,
    validator: (_, v: string, cb) => {
      if (!v) return cb('用户名不能为空')
      if (/\s/.test(v)) return cb('用户名不能包含空白字符')
      cb()
    },
  },
  roleId: {
    required: true,
    message: '必须选择一个权限',
  },
}

const invitationUrl = computed(() => {
  const { code, username } = form.value
  if (!code || !username) return
  const url = new URL(location.origin)
  url.searchParams.append(
    RouteQuery.Invitation.getKey(),
    RouteQuery.Invitation.stringify({ code, username }),
  )
  return url.toString()
})

const copyInvitationCode = async () => {
  if (!invitationUrl.value) return
  try {
    await navigator.clipboard.writeText(invitationUrl.value)
    ElMessage.success('邀请链接已复制到剪贴板')
  } catch {
    // cancel
  }
}
</script>

<template>
  <WinDialog class="w-[330px]">
    <WinDialogTitleBar :loading="loading" @close="() => emits('close')">
      {{ props.title }}
    </WinDialogTitleBar>

    <WinDialogTabPanel>
      <el-form ref="formRef" label-position="top" :disabled="loading" :model="form" :rules="rules">
        <el-form-item label="用户名" prop="username" :disabled="isUpdateMode">
          <el-input v-model="form.username" />
        </el-form-item>

        <el-form-item label="权限" prop="roleId">
          <el-select-v2
            v-model="form.roleId"
            :options="userStore.roleList"
            :props="{
              label: 'name',
              value: 'id',
            }"
            :disabled="userStore.roleListLoading"
            :loading="userStore.roleListLoading"
          />
        </el-form-item>

        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" />
        </el-form-item>

        <el-form-item label="登录策略" prop="accessPolicy">
          <el-select-v2
            v-model="form.accessPolicy"
            :options="GROUPED_ACCESS_POLICY_OPTIONS"
            :props="{ label: 'label', value: 'value', options: 'options' }"
            multiple
          />
        </el-form-item>

        <el-form-item v-if="invitationUrl" label="邀请链接" style="margin-bottom: 0">
          <el-button
            :icon="ElIcons.Link"
            :disabled="!isSame"
            class="w-full"
            @click="copyInvitationCode"
          >
            {{ isSame ? '复制链接' : '提交更新后获取' }}
          </el-button>
        </el-form-item>
      </el-form>
    </WinDialogTabPanel>

    <WinDialogFooter>
      <el-button
        :loading="loading"
        :disabled="isSame"
        :icon="ElIcons.Check"
        type="primary"
        @click="submit"
      >
        确认
      </el-button>
      <el-button
        :loading="loading"
        :disabled="loading"
        :icon="ElIcons.Close"
        @click="() => emits('close')"
      >
        取消
      </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
