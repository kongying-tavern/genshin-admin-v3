<script setup lang="ts">
import type { DiagnosticRecord, RttMeasurement } from '@/database/websocket/types'
import { CircleCheck, Clock, Connection, Warning } from '@element-plus/icons-vue'
import { liveQuery } from 'dexie'
import { WEBSOCKET_WORKER_CONFIG } from '@/configs/websocket'
import { wsdb } from '@/database/websocket'
import {
  latestDiagnosticIssue,
  latestDiagnosticMeasurement,
  latestSuccessfulMeasurement,
  recentDiagnostics,
} from '@/database/websocket/diagnostics'
import { useSocketStore } from '@/stores'
import SettingBar from '../../components/SettingBar.vue'
import {
  formatDiagnosticTime,
  formatMilliseconds,
  groupDiagnostics,
  issuePageLabel,
  recordLabel,
  recordStatus,
  stepLabel,
} from './diagnostic-presentation'
import DiagnosticTimeline from './DiagnosticTimeline.vue'

interface Summary {
  accountId: string
  issue?: DiagnosticRecord
  latest?: DiagnosticRecord
  measurement?: RttMeasurement
  success?: RttMeasurement
}

const PAGE_SIZE = 20
const socketStore = useSocketStore()
const accountId = computed(() => socketStore.context.accountId)
const pageId = computed(() => socketStore.context.id)
const expanded = ref(false)
const limit = ref(PAGE_SIZE)
const failedRead = ref(false)
const summary = shallowRef<Summary>()
const records = shallowRef<DiagnosticRecord[]>([])
const selectedId = ref<string>()
const selected = shallowRef<DiagnosticRecord>()
const timelineStart = ref<HTMLElement>()

const onReadError = () => {
  failedRead.value = true
}

watch(
  accountId,
  (id, _, onCleanup) => {
    summary.value = undefined
    failedRead.value = false
    if (!id) return

    const subscription = liveQuery(async (): Promise<Summary> => {
      const [issue, [latest], measurement, success] = await Promise.all([
        latestDiagnosticIssue(id),
        recentDiagnostics(id, 1),
        latestDiagnosticMeasurement(id),
        latestSuccessfulMeasurement(id),
      ])
      return { accountId: id, issue, latest, measurement, success }
    }).subscribe({ next: value => (summary.value = value), error: onReadError })
    onCleanup(() => subscription.unsubscribe())
  },
  { immediate: true },
)

watch(
  [accountId, expanded],
  () => {
    limit.value = PAGE_SIZE
    selected.value = undefined
    selectedId.value = undefined
    records.value = []
  },
  { flush: 'sync' },
)

const select = (record: DiagnosticRecord) => {
  if (record.accountId !== accountId.value) return
  selected.value = record
  selectedId.value = record.id
}

const selectFromHistory = async (record: DiagnosticRecord, event: MouseEvent) => {
  select(record)
  if (event.detail > 0) {
    await nextTick()
    timelineStart.value?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

watch([summary, expanded], ([value, open]) => {
  if (!open || selectedId.value || !value || value.accountId !== accountId.value) return
  const record = value.issue ?? value.latest
  if (record) select(record)
})

watch([accountId, expanded, limit], ([id, open, count], _, onCleanup) => {
  if (!id || !open) return
  const subscription = liveQuery(() => recentDiagnostics(id, count + 1)).subscribe({
    next: value => (records.value = value),
    error: onReadError,
  })
  onCleanup(() => subscription.unsubscribe())
})

watch([accountId, selectedId], ([account, id], _, onCleanup) => {
  if (!account || !id) return
  const subscription = liveQuery(() => wsdb.diagnostics.get(id)).subscribe({
    next: value => {
      if (value?.accountId === account) selected.value = value
    },
    error: onReadError,
  })
  onCleanup(() => subscription.unsubscribe())
})

const groups = computed(() => {
  const result = groupDiagnostics(records.value.slice(0, limit.value))
  const record = selected.value
  if (record && !result.some(group => group.ids.includes(record.id)))
    result.push({ record, ids: [record.id] })
  return result
})

const networkStatus = computed(() => {
  const { attachment, status, reason } = socketStore.context
  if (attachment === 'starting') return { label: '接入后台中', tone: 'warning', icon: Clock }
  if (attachment === 'timeout') return { label: '后台未回应', tone: 'warning', icon: Warning }
  if (attachment === 'failed') return { label: '后台接入失败', tone: 'danger', icon: Warning }
  if (status === 'OPEN') return { label: '已连接', tone: 'positive', icon: CircleCheck }
  if (status === 'CONNECTING') return { label: '正在连接', tone: 'warning', icon: Clock }
  if (reason)
    return {
      label: reason === 'connect-error' ? '建立连接失败' : '连接中断',
      tone: 'danger',
      icon: Warning,
    }
  return { label: '未连接', tone: 'neutral', icon: Connection }
})

const measurement = computed(() => socketStore.context.measurement)
const latestCheck = computed(() => measurement.value ?? summary.value?.measurement)
const latestSuccess = computed(() => socketStore.context.lastSuccess ?? summary.value?.success)
const hasCurrentSample = computed(() => measurement.value?.outcome === 'success')
const latency = computed(() => {
  const { status } = socketStore.context
  if (status === 'CONNECTING') return '连接中'
  if (status !== 'OPEN') return '未连接'
  if (!measurement.value) return '待测'
  if (measurement.value.outcome === 'timeout') return '本次检测超时'
  if (measurement.value.outcome === 'invalid') return '暂无有效样本'
  return formatMilliseconds(measurement.value.roundTripMs)
})

const latestIssue = computed(() => summary.value?.issue)
const issueText = computed(() => {
  const record = latestIssue.value
  if (!record?.firstIssue) return ''
  return [
    stepLabel(record.firstIssue),
    issuePageLabel(record, pageId.value),
    record.recoveryAt === undefined
      ? undefined
      : `恢复于 ${formatDiagnosticTime(record.recoveryAt)}`,
  ]
    .filter(Boolean)
    .join(' · ')
})

const { RTT } = WEBSOCKET_WORKER_CONFIG
const intervalNote = `每轮间隔 ${RTT.INTERVAL / 1000} 秒 · 回复限时 ${RTT.TIMEOUT / 1000} 秒`
</script>

<template>
  <div class="network-diagnostics">
    <SettingBar label="响应时延" :note="intervalNote">
      <template #setting>
        <div class="latency">
          <strong :class="{ 'latency-measured': hasCurrentSample }">{{ latency }}</strong>
          <span v-if="hasCurrentSample && measurement"
            >测于 {{ formatDiagnosticTime(measurement.measuredAt) }}</span
          >
          <span v-else-if="latestSuccess"
            >上次成功 {{ formatMilliseconds(latestSuccess.roundTripMs) }} ·
            {{ formatDiagnosticTime(latestSuccess.measuredAt) }}</span
          >
        </div>
      </template>
    </SettingBar>

    <SettingBar label="通信诊断" @expanded="expanded = $event">
      <template #note>
        <div class="diagnostic-overview">
          <span v-if="latestCheck"
            >最近检测 {{ formatDiagnosticTime(latestCheck.measuredAt) }}</span
          >
          <span v-else>{{ summary?.latest ? '等待首次检测' : '等待首次通信' }}</span>
          <span v-if="latestIssue" class="diagnostic-last-issue">最近异常 · {{ issueText }}</span>
          <span
            v-if="socketStore.context.diagnosticsIncomplete || failedRead"
            class="diagnostic-incomplete"
          >
            本次记录可能不完整
          </span>
        </div>
      </template>
      <template #setting>
        <span class="diagnostic-status" :data-tone="networkStatus.tone" aria-live="polite">
          <el-icon aria-hidden="true"><component :is="networkStatus.icon" /></el-icon>
          {{ networkStatus.label }}
        </span>
      </template>
      <template #detail>
        <div v-if="expanded && selected" class="diagnostic-body">
          <div class="min-w-0">
            <div ref="timelineStart" aria-hidden="true" />
            <DiagnosticTimeline :record="selected" :current-page-id="pageId" />
          </div>

          <section class="diagnostic-history" aria-label="最近往来">
            <h3>最近往来</h3>
            <ol class="diagnostic-history-list" role="list">
              <li
                v-for="group in groups"
                :key="selectedId && group.ids.includes(selectedId) ? selectedId : group.record.id"
              >
                <button
                  type="button"
                  class="diagnostic-history-button"
                  :aria-pressed="!!selectedId && group.ids.includes(selectedId)"
                  @click="selectFromHistory(group.record, $event)"
                >
                  <span class="diagnostic-history-heading">
                    <strong>{{ recordLabel(group.record) }}</strong>
                    <span class="diagnostic-result" :data-tone="recordStatus(group.record).tone">{{
                      recordStatus(group.record).label
                    }}</span>
                  </span>
                  <span class="diagnostic-history-meta">
                    <time :datetime="new Date(group.record.startedAt).toISOString()">{{
                      formatDiagnosticTime(group.record.startedAt)
                    }}</time>
                    <span v-if="group.ids.length > 1">×{{ group.ids.length }}</span>
                    <span v-if="group.record.measurement?.outcome === 'success'">{{
                      formatMilliseconds(group.record.measurement.roundTripMs)
                    }}</span>
                  </span>
                  <span v-if="group.record.firstIssue" class="diagnostic-history-meta">
                    {{ stepLabel(group.record.firstIssue) }}
                    <span v-if="issuePageLabel(group.record, pageId)">
                      · {{ issuePageLabel(group.record, pageId) }}</span
                    >
                  </span>
                </button>
              </li>
            </ol>
            <button
              v-if="records.length > limit"
              type="button"
              class="diagnostic-more"
              @click="limit += PAGE_SIZE"
            >
              查看更早记录
            </button>
          </section>
        </div>
        <p v-else-if="expanded" class="diagnostic-empty">
          {{ failedRead ? '暂时无法读取通信记录' : '等待首次通信' }}
        </p>
      </template>
    </SettingBar>
  </div>
</template>

<style scoped>
.network-diagnostics {
  --diagnostic-positive: light-dark(#16705f, #86cbb9);
  --diagnostic-warning: light-dark(#8e4b18, #f0bf89);
  --diagnostic-danger: light-dark(#973a39, #f3a5a2);
  display: grid;
  gap: 4px;
  min-width: 0;
  container-type: inline-size;
}

.latency {
  display: grid;
  gap: 2px;
  max-width: min(47cqw, 240px);
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.latency strong {
  font-size: 13px;
  font-weight: 650;
}

.latency strong.latency-measured {
  color: var(--diagnostic-positive);
  font-size: 20px;
  line-height: 1.2;
}

.latency span,
.diagnostic-overview {
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.45;
}

.diagnostic-overview {
  display: grid;
  gap: 2px;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}

.diagnostic-last-issue,
.diagnostic-incomplete {
  color: var(--diagnostic-warning);
}

.diagnostic-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.diagnostic-status[data-tone='positive'] {
  background: light-dark(#e7f3ef, #203932);
}

.diagnostic-status[data-tone='warning'] {
  background: var(--el-color-warning-light-9);
}

.diagnostic-status[data-tone='danger'] {
  background: var(--el-color-danger-light-9);
}

[data-tone='positive'] {
  color: var(--diagnostic-positive);
}

[data-tone='warning'] {
  color: var(--diagnostic-warning);
}

[data-tone='danger'] {
  color: var(--diagnostic-danger);
}

.diagnostic-body {
  display: grid;
  align-items: start;
  gap: 8px;
  min-width: 0;
}

@container (min-width: 545px) {
  .diagnostic-body {
    grid-template-columns: minmax(0, 1fr) minmax(166px, 0.58fr);
  }
}

.diagnostic-history {
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.diagnostic-history h3 {
  margin: 0;
  padding: 9px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 650;
}

.diagnostic-history-list {
  display: grid;
  gap: 3px;
  margin: 0;
  padding: 4px;
  list-style: none;
}

.diagnostic-history-button {
  display: grid;
  gap: 3px;
  width: 100%;
  padding: 6px 7px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--el-text-color-primary);
  text-align: left;
}

.diagnostic-history-button:hover {
  background: var(--el-fill-color-light);
}

.diagnostic-history-button[aria-pressed='true'] {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.diagnostic-history-button:focus-visible,
.diagnostic-more:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.diagnostic-history-heading,
.diagnostic-history-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  font-size: 12px;
}

.diagnostic-history-heading {
  justify-content: space-between;
}

.diagnostic-history-heading strong {
  font-weight: 650;
}

.diagnostic-history-meta {
  color: var(--el-text-color-regular);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.diagnostic-more {
  width: 100%;
  padding: 7px 4px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--el-color-primary);
  font-size: 12px;
}

.diagnostic-more:hover {
  background: var(--el-fill-color-light);
}

.diagnostic-empty {
  margin: 2px 4px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}
</style>
