<script setup lang="ts">
import { Refresh, RefreshLeft, WarnTriangleFilled } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import db from '@/database'
import { now } from '@/shared'
import {
  useAreaStore,
  useIconStore,
  useItemStore,
  useItemTypeStore,
  useMarkerLinkStore,
  useMarkerStore,
} from '@/stores'
import { MANAGER_PHASE_LABELS } from '@/stores/hooks'
import { SettingBar, SettingGroup, SettingPanel } from '../components'

const areaStore = useAreaStore()
const iconStore = useIconStore()
const itemStore = useItemStore()
const itemTypeStore = useItemTypeStore()
const markerStore = useMarkerStore()
const markerLinkStore = useMarkerLinkStore()

const dbList = [
  {
    label: '地区',
    total: computed(() => areaStore.total),
    loading: computed(() => areaStore.updateLoading),
    nextUpdateTime: computed(() => areaStore.nextUpdateTime),
    message: computed(() => areaStore.context.message),
    error: computed(() => areaStore.managerError),
    progress: computed(() => areaStore.progress),
    isActive: computed(() => areaStore.isActive),
    updateDiff: () => areaStore.update(),
    updateFull: () => areaStore.update({ isFull: true }),
  },
  {
    label: '图标',
    total: computed(() => iconStore.total),
    loading: computed(() => iconStore.updateLoading),
    nextUpdateTime: computed(() => iconStore.nextUpdateTime),
    message: computed(() => iconStore.context.message),
    error: computed(() => iconStore.managerError),
    progress: computed(() => iconStore.progress),
    isActive: computed(() => iconStore.isActive),
    updateDiff: () => iconStore.update(),
    updateFull: () => iconStore.update({ isFull: true }),
  },
  {
    label: '物品',
    total: computed(() => itemStore.total),
    loading: computed(() => itemStore.updateLoading),
    nextUpdateTime: computed(() => itemStore.nextUpdateTime),
    message: computed(() => itemStore.context.message),
    error: computed(() => itemStore.managerError),
    progress: computed(() => itemStore.progress),
    isActive: computed(() => itemStore.isActive),
    updateDiff: () => itemStore.update(),
    updateFull: () => itemStore.update({ isFull: true }),
  },
  {
    label: '物品类型',
    total: computed(() => itemTypeStore.total),
    loading: computed(() => itemTypeStore.updateLoading),
    nextUpdateTime: computed(() => itemTypeStore.nextUpdateTime),
    message: computed(() => itemTypeStore.context.message),
    error: computed(() => itemTypeStore.managerError),
    progress: computed(() => itemTypeStore.progress),
    isActive: computed(() => itemTypeStore.isActive),
    updateDiff: () => itemTypeStore.update(),
    updateFull: () => itemTypeStore.update({ isFull: true }),
  },
  {
    label: '点位',
    total: computed(() => markerStore.total),
    loading: computed(() => markerStore.updateLoading),
    nextUpdateTime: computed(() => markerStore.nextUpdateTime),
    message: computed(() => markerStore.context.message),
    error: computed(() => markerStore.managerError),
    progress: computed(() => markerStore.progress),
    isActive: computed(() => markerStore.isActive),
    updateDiff: () => markerStore.update(),
    updateFull: () => markerStore.update({ isFull: true }),
  },
  {
    label: '点位关联',
    total: computed(() => markerLinkStore.total),
    loading: computed(() => markerLinkStore.updateLoading),
    nextUpdateTime: computed(() => markerLinkStore.nextUpdateTime),
    message: computed(() => markerLinkStore.context.message),
    error: computed(() => markerLinkStore.managerError),
    progress: computed(() => markerLinkStore.progress),
    isActive: computed(() => markerLinkStore.isActive),
    updateDiff: () => markerLinkStore.update(),
    updateFull: () => markerLinkStore.update({ isFull: true }),
  },
]

/** 进度条状态：失败优先，其次沿用管理器给出的完成态 */
const progressStatus = (store: (typeof dbList)[number]) => {
  if (store.error.value) return 'exception'
  return store.progress.value.status === 'success' ? 'success' : ''
}

/** 进度文案：写入等阶段不会改写 store 的消息，靠阶段名说明进度条在做什么 */
const progressText = (store: (typeof dbList)[number]) => {
  const { phase, percentage } = store.progress.value
  return `${phase ? `${MANAGER_PHASE_LABELS[phase]} ` : ''}${Math.round(percentage)}%`
}

const deleteDatabase = async () => {
  try {
    await ElMessageBox.confirm('将会完全删除数据库内所有数据并刷新页面，确认操作？', '警告', {
      type: 'warning',
      closeOnClickModal: false,
      closeOnPressEscape: false,
      closeOnHashChange: false,
      showClose: false,
      distinguishCancelAndClose: true,
      cancelButtonClass: 'el-button--primary el-button--danger',
      cancelButtonText: '确定',
      confirmButtonClass: 'el-button--info is-text',
      confirmButtonText: '取消',
      beforeClose: async (action, instance, done) => {
        if (action !== 'cancel') return done()
        instance.cancelButtonLoading = true
        await db.delete().catch(() => false)
        instance.cancelButtonLoading = false
        done()
        location.reload()
      },
    })
  } catch {
    // cancel, no error
  }
}
</script>

<template>
  <SettingPanel>
    <SettingGroup name="存储详情">
      <SettingBar v-for="store in dbList" :key="store.label" :label="store.label">
        <template #note>
          <div class="text-xs text-[var(--el-text-color-regular)] mb-0.5">
            共 {{ store.total.value }} 项{{
              !store.isActive.value
                ? '，更新已暂停'
                : store.loading.value
                  ? ''
                  : `，距离下次更新还有 ${((store.nextUpdateTime.value - now) / 1000).toFixed(0)} 秒`
            }}
          </div>
          <div class="flex items-center gap-2">
            <el-progress
              class="flex-1 min-w-0"
              :percentage="store.progress.value.percentage"
              :stroke-width="10"
              :duration="5"
              :show-text="false"
              :striped="store.loading.value"
              :striped-flow="store.loading.value"
              :status="progressStatus(store)"
              style="--progress-radius: 2px"
            />
            <div
              class="text-xs tabular-nums text-[var(--el-text-color-regular)] w-[76px] text-right"
            >
              {{ progressText(store) }}
            </div>
          </div>
          <div
            v-if="store.error.value || store.message.value"
            class="text-xs mt-0.5 truncate"
            :class="
              store.error.value
                ? 'text-[var(--el-color-danger)]'
                : 'text-[var(--el-text-color-secondary)]'
            "
            :title="store.error.value || store.message.value"
          >
            {{ store.error.value || store.message.value }}
          </div>
        </template>

        <template #setting>
          <div class="flex flex-col">
            <el-button
              text
              type="primary"
              :icon="RefreshLeft"
              :loading="store.loading.value"
              @click="store.updateDiff"
            >
              差异更新
            </el-button>
            <el-button
              text
              type="warning"
              :icon="Refresh"
              style="margin-left: 0"
              :loading="store.loading.value"
              @click="store.updateFull"
            >
              重新获取
            </el-button>
          </div>
        </template>
      </SettingBar>
    </SettingGroup>

    <SettingGroup name="数据库设置">
      <SettingBar label="删除数据库" note="删除数据库并刷新应用来尝试解决数据库错误">
        <template #setting>
          <el-button type="danger" :icon="WarnTriangleFilled" @click="deleteDatabase">
            立即删除
          </el-button>
        </template>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>
