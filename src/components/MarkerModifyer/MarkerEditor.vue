<script lang="ts" setup>
import type { MarkerVo } from '@/api/alova/globals'
import type { GSMapState } from '@/stores/types/genshin-map-state'
import { Check, Close, Right } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cloneDeep, isEqual } from 'lodash'
import { useUserStore } from '@/stores'
import { MarkerForm } from './components'
import { useMarkerEdit, useRemoteMarker } from './hooks'

const props = defineProps<{
  markerInfo: GSMapState.MarkerWithRenderConfig
}>()

const emits = defineEmits<{
  close: [GSMapState.MarkerWithRenderConfig]
}>()

const isOfflineMode = import.meta.env.VITE_DEVELOPMENT_MODE === 'offline'

/** 表单数据 */
const form = ref(cloneDeep(props.markerInfo))

/** 原始表单数据（进入 editor 时的快照） */
const originalForm = ref<MarkerVo>(cloneDeep(props.markerInfo))

/** 已修改的字段集合 */
const modifiedFields = ref<Set<keyof MarkerVo>>(new Set())

/** 最后一次处理的远程版本号 */
const lastHandledRemoteVersion = ref<number | undefined>(props.markerInfo.version)

/** 是否已经初始化完成（用于避免在初始化时触发更新提示） */
const isInitialized = ref(false)

/** 确认对话框是否正在显示（用于防止重复弹窗） */
const isConfirmDialogShowing = ref(false)

const userStore = useUserStore()

// 实时更新的远程点位数据
const { data: remoteMarker, loading: remoteMarkerLoading } = useRemoteMarker(
  computed(() => props.markerInfo.id),
)

const editorRef = ref<InstanceType<typeof MarkerForm> | null>(null)

const { loading, submit, onSuccess } = useMarkerEdit(form, editorRef)

onSuccess(() => emits('close', form.value))

/**
 * 比较两个值是否相等（深度比较）
 */
const deepEqual = (a: unknown, b: unknown): boolean => {
  return isEqual(a, b)
}

/**
 * 检测表单字段的变化
 * version 字段不由用户控制，不参与修改检测
 */
const detectFieldChanges = () => {
  const changedFields = new Set<keyof MarkerVo>()

  // 需要比较的字段（排除系统字段、render 属性和 version 字段）
  const fieldsToCheck: (keyof MarkerVo)[] = [
    'markerTitle',
    'position',
    'itemList',
    'content',
    'picture',
    'videoPath',
    'refreshTime',
    'hiddenFlag',
    'extra',
    'linkageId',
    'markerStamp',
    'markerCreatorId',
    'pictureCreatorId',
  ]

  for (const field of fieldsToCheck) {
    const originalValue = originalForm.value[field]
    const currentValue = form.value[field]

    if (!deepEqual(originalValue, currentValue)) {
      changedFields.add(field)
    }
  }

  modifiedFields.value = changedFields
}

// 监听表单变化，检测字段修改
watch(
  () => form.value,
  () => {
    detectFieldChanges()
  },
  { deep: true },
)

/**
 * 合并远程数据到当前表单
 * 冲突处理：用户未修改过的字段直接覆盖，用户修改过的字段忽略
 * version 字段始终用远程数据覆盖（不由用户控制）
 */
const mergeRemoteData = (remote: MarkerVo) => {
  const merged = cloneDeep(form.value)

  // version 字段始终用远程数据覆盖（不由用户控制）
  if (remote.version !== undefined) {
    merged.version = remote.version
  }

  // 需要合并的字段（排除 version，已单独处理）
  const fieldsToMerge: (keyof MarkerVo)[] = [
    'markerTitle',
    'position',
    'itemList',
    'content',
    'picture',
    'videoPath',
    'refreshTime',
    'hiddenFlag',
    'extra',
    'linkageId',
    'markerStamp',
    'markerCreatorId',
    'pictureCreatorId',
    'updaterId',
    'updateTime',
  ]

  for (const field of fieldsToMerge) {
    // 如果用户未修改此字段，则用远程数据覆盖
    if (!modifiedFields.value.has(field) && remote[field] !== undefined) {
      ;(merged as Record<string, unknown>)[field as string] = cloneDeep(remote[field])
    }
  }

  // 更新表单数据
  Object.assign(form.value, merged)

  // 更新原始表单数据为新的远程数据，重置修改追踪
  originalForm.value = cloneDeep(merged)
  modifiedFields.value.clear()
  lastHandledRemoteVersion.value = remote.version
}

/**
 * 处理远程数据更新
 */
const handleRemoteUpdate = async () => {
  if (!remoteMarker.value || remoteMarkerLoading.value) return

  const remoteVersion = remoteMarker.value.version
  if (!Number.isInteger(remoteVersion) || remoteVersion === undefined) return

  // 初始化时，将远程版本设置为已处理版本，避免初始加载时触发提示
  if (!isInitialized.value) {
    lastHandledRemoteVersion.value = remoteVersion
    isInitialized.value = true
    return
  }

  // 如果版本没有更新，跳过
  if (remoteVersion === lastHandledRemoteVersion.value) return

  // 如果远程版本低于或等于当前处理的版本，跳过
  if (
    lastHandledRemoteVersion.value !== undefined
    && remoteVersion <= lastHandledRemoteVersion.value
  ) {
    return
  }

  // 如果确认对话框正在显示，跳过（防止重复弹窗）
  if (isConfirmDialogShowing.value) return

  // 如果更新来自当前用户，自动应用更新（不弹窗）
  const currentUserId = userStore.info?.id
  if (currentUserId !== undefined && remoteMarker.value.updaterId === currentUserId) {
    mergeRemoteData(remoteMarker.value)
    return
  }

  // 显示确认对话框
  isConfirmDialogShowing.value = true
  try {
    await ElMessageBox.confirm('点位数据已更新，是否应用最新数据？', '提示', {
      type: 'info',
      closeOnClickModal: false,
      closeOnPressEscape: false,
      distinguishCancelAndClose: true,
      confirmButtonText: '应用',
      cancelButtonText: '取消',
    })

    // 用户确认，合并远程数据
    mergeRemoteData(remoteMarker.value)

    ElMessage.success({
      message: '已应用最新数据',
    })
  } catch {
    // 用户取消，仅更新版本号避免重复提示
    lastHandledRemoteVersion.value = remoteVersion
  } finally {
    // 重置对话框显示标志
    isConfirmDialogShowing.value = false
  }
}

// 监听远程数据变化（包括加载状态）
watch(
  [() => remoteMarker.value?.version, () => remoteMarkerLoading.value],
  () => {
    if (!remoteMarkerLoading.value) {
      handleRemoteUpdate()
    }
  },
  { immediate: false },
)

const idText = computed(() => {
  const { id } = props.markerInfo
  if (!id) return ''
  return `ID：${id}`
})

const copyId = async () => {
  if (props.markerInfo?.id === undefined) return
  const idStr = `${props.markerInfo?.id}`
  await navigator.clipboard.writeText(idStr)
  ElMessage.success({
    message: `"${idStr}" 已复制到剪贴板`,
  })
}
</script>

<template>
  <MarkerForm
    ref="editorRef"
    v-model="form"
    :title="`${markerInfo.id} ${markerInfo.markerTitle}`"
    :loading="loading"
    @close="() => emits('close', markerInfo)"
  >
    <template #title>
      <div class="flex">
        <div
          class="min-w-[80px] px-1 rounded-[2px] flex-shrink-0 bg-[#3E4556] outline outline-[#3E4556] outline-2 -outline-offset-1 text-sm text-[#CDB78B] decoration-[#CDB78B] decoration-dashed hover:underline active:decoration-solid cursor-pointer"
          @click="copyId"
        >
          {{ idText }}
        </div>

        <div
          class="ml-2 text-sm max-w-[282px] flex-1 whitespace-nowrap overflow-hidden text-ellipsis"
          :title="markerInfo.markerTitle"
        >
          {{ markerInfo.markerTitle }}
        </div>
      </div>
    </template>

    <template #footer>
      <!-- 版本指示器 -->
      <div class="flex-1 flex items-center gap-2">
        <el-tag disable-transitions>
          {{ `本地版本：${form.version}` }}
        </el-tag>
        <el-icon>
          <Right />
        </el-icon>
        <el-tag disable-transitions>
          {{
            `最新版本：${remoteMarkerLoading ? 'Loading...' : Number.isInteger(remoteMarker?.version) ? remoteMarker?.version : '--'}`
          }}
        </el-tag>
      </div>

      <!-- 操作栏 -->
      <div class="shrink-0 flex justify-end">
        <el-button
          :icon="Check"
          type="primary"
          :disabled="isOfflineMode"
          :loading="loading"
          @click="submit"
        >
          保存
        </el-button>
        <el-button :icon="Close" :disabled="loading" @click="() => emits('close', markerInfo)">
          取消
        </el-button>
      </div>
    </template>
  </MarkerForm>
</template>
