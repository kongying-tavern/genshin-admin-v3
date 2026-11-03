<script setup lang="ts">
import type { ElForm, FormItemRule } from 'element-plus'
import type { ShallowRef } from 'vue'
import type { SysUserPasswordUpdateVo, SysUserVo } from '@/api/alova/globals'
import { CircleCheck, Delete, PictureFilled, RefreshLeft } from '@element-plus/icons-vue'
import { WinDialog, WinDialogTabPanel, WinDialogTitleBar } from '@/components'
import { ExitLeft } from '@/components/GenshinUI/GSIcon'
import { GROUPED_ACCESS_POLICY_OPTIONS } from '@/shared'
import { useUserStore } from '@/stores'
import { usePasswordUpdate, useUserEdit } from '../hooks'
import UserDeleteConfirm from './UserDeleteConfirm.vue'
import UserDevice from './UserDevice.vue'
import UserKickoutConfirm from './UserKickoutConfirm.vue'
import UserPasswordEditor from './UserPasswordEditor.vue'

const props = defineProps<{
  data: SysUserVo
}>()

const emits = defineEmits<{
  success: []
  close: []
}>()

const userStore = useUserStore()

// ==================== 面板状态 ====================
/** 当前打开的面板是否为自己 */
const isYourSelf = computed(() => userStore.info?.id === props.data.id)

/** 面板任务处理状态 */
const panelLoading = ref(false)

/** 用户操作类型 */
const action = ref('')

/** 详情面板可用 tab */
const tabs = [
  { key: 'baseinfo', name: '基本信息' },
  { key: 'password', name: '修改密码' },
  { key: 'device', name: '设备管理' },
]

/** 详情面板当前激活 tab */
const tabKey = ref('baseinfo')

const onDeleteSuccess = () => {
  emits('close')
  emits('success')
}

// ==================== 修改信息 ====================
const useInfoRaw = ref<SysUserVo>(JSON.parse(JSON.stringify(props.data)))

const userInfoForm = ref<SysUserVo>(JSON.parse(JSON.stringify(props.data)))

const isChanged = computed(
  () => JSON.stringify(userInfoForm.value) !== JSON.stringify(useInfoRaw.value),
)

const resetUserInfo = () => {
  userInfoForm.value = JSON.parse(JSON.stringify(props.data))
}

const rules: Partial<Record<keyof SysUserVo, FormItemRule>> = {
  roleId: {
    required: true,
    message: '角色不能为空',
  },
}

const formRef = shallowRef<InstanceType<typeof ElForm>>()
const { submit, onSuccess: onEditSuccess } = useUserEdit(
  userInfoForm,
  formRef as ShallowRef<InstanceType<typeof ElForm>>,
  {
    loading: panelLoading,
  },
)

onEditSuccess(() => {
  useInfoRaw.value = JSON.parse(JSON.stringify(userInfoForm.value))
  emits('close')
  emits('success')
})

// ==================== 修改密码 ====================
const passwordForm = ref<SysUserPasswordUpdateVo>({
  userId: props.data.id,
  password: '',
})

const { submit: submitPwsUpdate, loading: pwdUpdateLoading } = usePasswordUpdate(passwordForm, {
  loading: panelLoading,
})
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar :loading="panelLoading" @close="() => emits('close')">
      用户详情
    </WinDialogTitleBar>

    <WinDialogTabPanel
      v-model:tab-key="tabKey"
      :tabs="tabs"
      :tabs-disabled="panelLoading"
      class="mb-2 w-[360px] max-w-[calc(100dvw_-_18px)] h-[530px]"
      style="padding: 0"
    >
      <div v-if="tabKey === 'baseinfo'" class="p-4">
        <div class="flex gap-4">
          <div
            class="w-32 h-32 border border-[var(--el-border-color)] rounded-sm grid place-items-center flex-shrink-0"
          >
            <img
              v-if="data.logo"
              :src="data.logo"
              class="w-full h-full object-contain"
              referrerpolicy="no-referrer"
            />
            <div v-else class="grid place-items-center text-[var(--el-text-color-secondary)]">
              <el-icon :size="32">
                <PictureFilled />
              </el-icon>
              <div>No image</div>
            </div>
          </div>

          <div class="flex-1 w-full flex flex-col">
            <div class="w-full grid gap-y-2 grid-cols-[48px_1fr] text-xs">
              <div class="font-bold">UID</div>
              <div>{{ data.id }}</div>

              <div class="font-bold">账号</div>
              <div class="whitespace-nowrap overflow-hidden text-ellipsis" :title="data.username">
                {{ data.username }}
              </div>
            </div>

            <div v-if="!isYourSelf" class="flex-1 flex justify-start items-end">
              <el-button
                :icon="Delete"
                type="danger"
                text
                title="删除用户"
                style="padding: 8px 10px"
                @click="action = 'delete'"
              >
                删除
              </el-button>
              <el-button
                :icon="ExitLeft"
                type="danger"
                text
                title="让该用户退出登录"
                style="padding: 8px 10px"
                @click="action = 'kickout'"
              >
                注销
              </el-button>
            </div>
          </div>
        </div>

        <el-divider style="margin: 16px 0" content-position="left"> 编辑信息 </el-divider>

        <el-form ref="formRef" :model="userInfoForm" label-width="70px" :rules="rules">
          <el-form-item label="昵称" prop="nickname">
            <el-input v-model="userInfoForm.nickname" placeholder="最好有一个" />
          </el-form-item>

          <el-form-item label="备注" prop="remark">
            <el-input v-model="userInfoForm.remark" />
          </el-form-item>

          <el-form-item label="角色" prop="roleId">
            <el-select-v2
              v-model="userInfoForm.roleId"
              :options="userStore.roleList"
              :props="{
                label: 'name',
                value: 'id',
              }"
            />
          </el-form-item>

          <el-form-item label="风控" prop="accessPolicy">
            <el-select-v2
              v-model="userInfoForm.accessPolicy"
              multiple
              collapse-tags
              collapse-tags-tooltip
              :options="GROUPED_ACCESS_POLICY_OPTIONS"
              clearable
            />
          </el-form-item>

          <el-form-item label="QQ" prop="qq">
            <el-input v-model="userInfoForm.qq" placeholder="选填" />
          </el-form-item>

          <el-form-item label="手机" prop="phone">
            <el-input v-model="userInfoForm.phone" placeholder="选填" />
          </el-form-item>
        </el-form>

        <div class="flex justify-end">
          <el-button
            :icon="CircleCheck"
            :loading="panelLoading"
            :disabled="!isChanged"
            type="primary"
            @click="submit"
          >
            保存
          </el-button>
          <el-button
            :icon="RefreshLeft"
            :disabled="!isChanged || panelLoading"
            @click="resetUserInfo"
          >
            重置
          </el-button>
        </div>
      </div>

      <div v-else-if="tabKey === 'password'" class="p-4">
        <UserPasswordEditor
          v-model="passwordForm"
          :loading="pwdUpdateLoading"
          @submit="submitPwsUpdate"
        />
      </div>

      <UserDevice
        v-else-if="tabKey === 'device'"
        v-model:loading="panelLoading"
        :data="useInfoRaw"
      />
    </WinDialogTabPanel>

    <UserKickoutConfirm v-model:action="action" :data="useInfoRaw" />

    <UserDeleteConfirm v-model:action="action" :data="useInfoRaw" @success="onDeleteSuccess" />
  </WinDialog>
</template>
