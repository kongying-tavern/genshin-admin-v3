<script lang="ts" setup>
import type { ComputedRef } from 'vue'
import type { NoticeVo } from '@/api/alova/globals'
import type { ElFormType } from '@/shared'
import type { ItemFormRules } from '@/utils'
import { Check, Close } from '@element-plus/icons-vue'
import {
  AppRichtextEditor,
  WinDialog,
  WinDialogFooter,
  WinDialogTabPanel,
  WinDialogTitleBar,
} from '@/components'
import { useFetchHook } from '@/hooks'
import { NOTICE_NAME_MAP } from '@/shared'
import { useNoticeCreate, useNoticeUpdate } from '../hooks'

const props = defineProps<{
  notice?: NoticeVo
  status: 'create' | 'update'
}>()

const emits = defineEmits<{
  success: []
  close: []
}>()

const formData = ref<NoticeVo>(JSON.parse(JSON.stringify(props.notice ?? {})))

const formRef = ref<ElFormType | null>(null)

const rules: ComputedRef<ItemFormRules<NoticeVo>> = computed(() => ({
  channel: [{ required: true, message: '频道不能为空', trigger: 'change' }],
  title: [{ required: true, message: '标题不能为空', trigger: 'blur' }],
  validTimeStart: [
    {
      trigger: 'change',
      validator: (_, value: number | null, cb) => {
        if (!value) return cb()
        if (!formData.value.validTimeEnd) return cb()
        if (value > new Date(formData.value.validTimeEnd).getTime())
          return cb('生效时间不能在截止时间之后')
        cb()
      },
    },
  ],
  validTimeEnd: [
    {
      trigger: 'change',
      validator: (_rule, value: number | null, cb) => {
        if (!value) return cb()
        if (!formData.value.validTimeStart) return cb()
        if (value < new Date(formData.value.validTimeStart).getTime())
          return cb('截止时间不能在生效时间之前')
        cb()
      },
    },
  ],
  content: [
    {
      required: true,
      trigger: 'blur',
      validator: (_, value: string, cb) => {
        const parser = new DOMParser()
        const dom = parser.parseFromString(value, 'text/html')
        if (!dom.body.textContent?.length) return cb('内容不能为空')
        cb()
      },
    },
  ],
}))

const { createNotice } = useNoticeCreate()
const { updateNotice } = useNoticeUpdate()

const {
  loading,
  refresh: submit,
  onSuccess,
} = useFetchHook({
  onRequest: () =>
    ({
      create: createNotice,
      update: updateNotice,
    })[props.status](formData.value),
})

const saveNotice = async () => {
  const res = await formRef.value?.validate().catch(() => false)
  if (!res) return
  await submit()
}

onSuccess(() => {
  emits('close')
  emits('success')
})

const channels = [...NOTICE_NAME_MAP.entries()].map(([channel, name]) => ({
  label: name,
  value: channel,
}))
</script>

<template>
  <WinDialog class="w-[1200px]">
    <WinDialogTitleBar :loading="loading" @close="() => emits('close')">
      {{ `${formData.id === undefined ? '添加' : '编辑'}公告` }}
    </WinDialogTitleBar>

    <WinDialogTabPanel>
      <el-form
        ref="formRef"
        v-bind="$attrs"
        label-width="80px"
        label-position="top"
        :model="formData"
        :rules="rules"
      >
        <div class="grid grid-cols-4 grid-rows-6 gap-y-1 gap-x-4">
          <el-form-item label="标题" prop="title">
            <el-input v-model="formData.title" placeholder="请输入标题" clearable />
          </el-form-item>

          <el-form-item label="内容" prop="content" class="col-span-3 row-span-6">
            <AppRichtextEditor
              v-model="formData.content"
              style="max-height: 600px"
              :content-height="636"
              :base-text-size="20"
              :headers="[2, 4]"
              default-foreground="#4f473f"
              default-background="#fff"
              view-font="MHYG, sans-serif"
              :view-line-height="1.5"
              :view-zoom="0.75"
            />
          </el-form-item>

          <el-form-item label="生效时间" prop="validTimeStart">
            <el-date-picker
              v-model="formData.validTimeStart"
              style="--el-date-editor-width: 100%"
              type="datetime"
              placeholder="请选择发布时间"
            />
          </el-form-item>

          <el-form-item label="截止时间" prop="validTimeEnd">
            <el-date-picker
              v-model="formData.validTimeEnd"
              style="--el-date-editor-width: 100%"
              type="datetime"
              placeholder="请选截止时间"
            />
          </el-form-item>

          <el-form-item label="频道" prop="channel">
            <el-select-v2
              v-model="formData.channel"
              style="width: 100%"
              placeholder="请选择频道"
              :options="channels"
              clearable
              collapse-tags
              collapse-tags-tooltip
              multiple
            />
          </el-form-item>

          <el-form-item label="排序" prop="sortIndex">
            <el-input-number v-model="formData.sortIndex" :min="0" style="width: 100%" />
          </el-form-item>
        </div>
      </el-form>
    </WinDialogTabPanel>

    <WinDialogFooter>
      <el-button :icon="Check" type="primary" :loading="loading" @click="saveNotice">
        确认
      </el-button>
      <el-button :icon="Close" :disabled="loading" @click="() => emits('close')"> 取消 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
