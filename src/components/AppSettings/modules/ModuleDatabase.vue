<script setup lang="ts">
import { Refresh, RefreshLeft, WarnTriangleFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import db from '@/database'
import { now } from '@/shared'
import { useMarkerStore } from '@/stores'
import { listDatasets } from '@/stores/datasetStatus'
import { MANAGER_PHASE_LABELS } from '@/stores/hooks'
import { useMapEntitySync } from '@/stores/mapEntitySync'
import { useSocketStore } from '@/stores/socket'
import { SettingBar, SettingGroup, SettingPanel } from '../components'

const dbList = listDatasets().map(dataset => ({
  key: dataset.key,
  label: dataset.label,
  total: computed(dataset.total),
  loading: computed(dataset.updating),
  nextUpdateTime: computed(dataset.nextUpdateTime),
  message: computed(dataset.message),
  error: computed(dataset.error),
  progress: computed(dataset.progress),
  isActive: computed(dataset.active),
  updateDiff: () => dataset.update(),
  updateFull: () => dataset.update({ full: true }),
}))

const entitySync = useMapEntitySync()
const socket = useSocketStore()
const marker = useMarkerStore()
const checkingDrafts = ref(false)
const recheckDrafts = async () => {
  checkingDrafts.value = true
  try {
    await marker.update()
    if (marker.managerError) ElMessage.error(marker.managerError)
    else ElMessage.success('点位已重新核对')
  } finally {
    checkingDrafts.value = false
  }
}

const acknowledgeDraft = async (key: string) => {
  const scope = entitySync.scope
  const confirmed = await ElMessageBox.confirm(
    '请先核对点位及历史记录。确认后会移除这条待核对草稿。',
    '确认处理草稿',
    { confirmButtonText: '已人工核对', cancelButtonText: '返回', type: 'warning' },
  ).then(
    () => true,
    () => false,
  )
  if (confirmed && scope === entitySync.scope) await marker.acknowledgeUnknownCreate(key)
}
const syncInfo = (key: (typeof dbList)[number]['key']) => {
  if (key !== 'marker' && key !== 'item' && key !== 'markerLink') return ''
  const state = entitySync.projection.state.resources[key]
  if (!state) return ''
  const result: string[] = []
  if (state.checkedAt) result.push(`最近在线核对 ${new Date(state.checkedAt).toLocaleString()}`)
  if (state.archiveTime) result.push(`归档 ${new Date(state.archiveTime).toLocaleString()}`)
  const ranges = state.pendingRanges?.length ?? 0
  const ids = entitySync.projection.pending[key].size
  if (ranges) result.push(`${ranges} 个范围待核对`)
  if (ids) result.push(`${ids} 个实体待核对`)
  return result.join(' · ')
}

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
      <SettingBar label="地图同步">
        <template #note>
          {{
            !entitySync.online
              ? '离线'
              : socket.context.status === 'OPEN'
                ? '实时连接已建立'
                : '实时连接未建立'
          }}
        </template>
      </SettingBar>
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
          <div
            v-if="syncInfo(store.key)"
            class="text-xs mt-0.5 text-[var(--el-text-color-regular)]"
          >
            {{ syncInfo(store.key) }}
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

    <SettingGroup v-if="marker.pendingCreates.length" name="待核对的点位创建">
      <SettingBar
        v-for="command in marker.pendingCreates"
        :key="command.key"
        :label="command.draft.markerTitle || '未命名点位'"
        :note="`坐标 ${command.draft.position ?? '未知'} · ${command.markerId ? `已创建 #${command.markerId}，详情同步中` : '结果待确认'}`"
      >
        <template #setting>
          <el-button text :loading="checkingDrafts" @click="recheckDrafts">核对点位</el-button>
          <el-button
            v-if="
              command.status === 'unknown'
              || (command.status === 'sending' && now - command.createdAt > 300000)
            "
            text
            @click="acknowledgeDraft(command.key)"
            >已人工核对</el-button
          >
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
