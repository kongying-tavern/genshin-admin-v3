<script setup lang="ts">
import type { DiagnosticActor, DiagnosticRecord, DiagnosticStep } from '@/database/websocket/types'
import {
  Check,
  CircleClose,
  Clock,
  Cloudy,
  Connection,
  Monitor,
  Warning,
} from '@element-plus/icons-vue'
import { isDiagnosticIssue } from '@/database/websocket/diagnostics'
import {
  ACTOR_LABELS,
  formatDiagnosticTime,
  formatMilliseconds,
  isConfirmed,
  pageIdsFor,
  REASON_LABELS,
  recordLabel,
  recordStatus,
  stepLabel,
} from './diagnostic-presentation'

const props = defineProps<{ record: DiagnosticRecord; currentPageId: string }>()
const actors = [
  { id: 'page', icon: Monitor },
  { id: 'worker', icon: Connection },
  { id: 'server', icon: Cloudy },
] as const
const lane: Record<DiagnosticActor, number> = { page: 1, worker: 2, server: 3 }

const pageChoice = ref('')
watch(
  () => props.record.id,
  () => {
    pageChoice.value = ''
  },
)

const pages = computed(() => pageIdsFor(props.record))
const pageId = computed(
  () =>
    pageChoice.value
    || (pages.value.includes(props.currentPageId)
      ? props.currentPageId
      : props.record.firstIssue?.pageId)
    || pages.value[0]
    || '',
)
const steps = computed(() =>
  props.record.steps
    .filter(step => !step.pageId || pageId.value === step.pageId)
    .sort((a, b) => a.order - b.order),
)
const issue = computed(() => steps.value.find(isDiagnosticIssue))
const lastConfirmed = computed(() =>
  steps.value.findLast(step => step.state === 'received' || step.state === 'success'),
)
const status = computed(() => recordStatus(props.record, steps.value))
const measurement = computed(() => props.record.measurement)
const metrics = computed(() => [
  { label: '检测总用时', value: measurement.value?.totalMs },
  { label: '服务器处理', value: measurement.value?.serverMs },
  { label: '网络往返', value: measurement.value?.roundTripMs },
])

const markerIcon = (step: DiagnosticStep) => {
  if (step.state === 'failed') return CircleClose
  if (isDiagnosticIssue(step)) return Warning
  if (step.state === 'processing' || step.state === 'ended') return Clock
  return Check
}

const position = (step: DiagnosticStep) => {
  const from = lane[step.from]
  const to = step.to ? lane[step.to] : from
  return { gridColumn: `${Math.min(from, to)} / ${Math.max(from, to) + 1}` }
}
</script>

<template>
  <section class="timeline" aria-label="通信步骤">
    <div class="timeline-summary" aria-live="polite">
      <div class="timeline-heading">
        <h3>{{ recordLabel(record) }}</h3>
        <span class="timeline-status" :data-tone="status.tone">{{ status.label }}</span>
      </div>
      <div class="timeline-meta">
        <time :datetime="new Date(record.startedAt).toISOString()">{{
          formatDiagnosticTime(record.startedAt)
        }}</time>
        <label v-if="pages.length > 1" class="timeline-page">
          <span class="sr-only">查看页面会话</span>
          <select :value="pageId" @change="pageChoice = ($event.target as HTMLSelectElement).value">
            <option v-for="id in pages" :key="id" :value="id">
              {{ id === currentPageId ? '本页' : `页面 ${id.slice(0, 8)}` }}
            </option>
          </select>
        </label>
        <span v-else-if="pageId">{{
          pageId === currentPageId ? '本页' : `页面 ${pageId.slice(0, 8)}`
        }}</span>
      </div>
      <div v-if="issue" class="timeline-issue" :data-state="issue.state">
        <el-icon aria-hidden="true">
          <component :is="markerIcon(issue)" />
        </el-icon>
        <div>
          <strong>{{ stepLabel(issue) }}</strong>
          <p v-if="issue.reason">
            {{ REASON_LABELS[issue.reason] }}
          </p>
          <p v-if="record.recoveryAt !== undefined">
            恢复于 {{ formatDiagnosticTime(record.recoveryAt) }}
          </p>
        </div>
      </div>
      <p v-else-if="record.exceptional" class="timeline-meta">其他页面有异常，可切换页面查看。</p>
      <p v-if="lastConfirmed" class="timeline-meta timeline-confirmed">
        最后确认 · {{ stepLabel(lastConfirmed) }}
      </p>
    </div>

    <div class="timeline-actors" aria-hidden="true">
      <div v-for="{ id, icon } in actors" :key="id" class="timeline-actor">
        <el-icon><component :is="icon" /></el-icon>
        <span>{{ ACTOR_LABELS[id] }}</span>
      </div>
    </div>
    <ol class="timeline-steps" aria-label="按观察顺序排列的步骤" role="list">
      <li
        v-for="step in steps"
        :key="`${step.code}-${step.lookup ?? ''}-${step.settles ?? ''}`"
        class="timeline-step"
      >
        <div
          v-if="step.to"
          class="timeline-transfer"
          :data-direction="lane[step.from] < lane[step.to] ? 'right' : 'left'"
          :data-confirmed="isConfirmed(step, steps)"
          :style="position(step)"
        >
          <span class="sr-only"
            >{{ ACTOR_LABELS[step.from] }}到{{ ACTOR_LABELS[step.to] }}，{{
              isConfirmed(step, steps) ? '送达已确认' : '送达待确认'
            }}。</span
          >
          <span class="timeline-transfer-label">{{ stepLabel(step) }}</span>
          <span class="timeline-arrow" aria-hidden="true" />
          <span
            v-if="step.code === 'rtt-send' && !isConfirmed(step, steps)"
            class="timeline-unconfirmed"
            aria-hidden="true"
            >是否收到待确认</span
          >
        </div>
        <div
          v-else
          class="timeline-point"
          :data-state="step.state"
          :style="position(step)"
          :title="step.reason ? REASON_LABELS[step.reason] : undefined"
        >
          <span class="sr-only">{{ ACTOR_LABELS[step.from] }}：</span>
          <el-icon aria-hidden="true">
            <component :is="markerIcon(step)" />
          </el-icon>
          <span>{{ stepLabel(step) }}</span>
          <span v-if="isDiagnosticIssue(step) && step.reason" class="sr-only">{{
            REASON_LABELS[step.reason]
          }}</span>
        </div>
      </li>
    </ol>
    <div class="timeline-legend" aria-label="箭头说明">
      <span><i aria-hidden="true" />送达已确认</span>
      <span><i aria-hidden="true" />送达待确认</span>
    </div>
    <dl v-if="measurement" class="timeline-metrics">
      <div v-for="metric in metrics" :key="metric.label">
        <dt>{{ metric.label }}</dt>
        <dd>{{ formatMilliseconds(metric.value) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.timeline {
  --line-confirmed: light-dark(#187568, #79c7b8);
  --line-pending: var(--el-text-color-secondary);
  --step-warning: light-dark(#924f1a, #f0bd89);
  --step-danger: light-dark(#963b39, #f3a29f);
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.timeline-summary {
  padding: 12px clamp(8px, 3%, 14px);
}

.timeline-heading,
.timeline-meta,
.timeline-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.timeline-heading h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 650;
}

.timeline-status {
  border-radius: 5px;
  padding: 1px 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 11px;
  font-weight: 600;
}

.timeline-status[data-tone='positive'] {
  background: light-dark(#e7f3ef, #203932);
  color: var(--line-confirmed);
}

.timeline-status[data-tone='warning'] {
  background: var(--el-color-warning-light-9);
  color: var(--step-warning);
}

.timeline-status[data-tone='danger'] {
  background: var(--el-color-danger-light-9);
  color: var(--step-danger);
}

.timeline-meta,
.timeline-legend,
.timeline-issue p {
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.timeline-meta time,
.timeline-metrics dd {
  font-variant-numeric: tabular-nums;
}

.timeline-page select {
  max-width: 100%;
  padding: 2px 4px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  color: inherit;
  background: var(--el-bg-color);
}

.timeline-issue {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 8px;
  padding: 7px 8px;
  border-inline-start: 2px solid currentColor;
  border-radius: 0 5px 5px 0;
  color: var(--step-warning);
  background: var(--el-color-warning-light-9);
  font-size: 12px;
}

.timeline-issue[data-state='failed'] {
  color: var(--step-danger);
  background: var(--el-color-danger-light-9);
}

.timeline-issue .el-icon {
  flex: none;
  margin-top: 2px;
  font-size: 14px;
}

.timeline-confirmed {
  margin-top: 6px;
}

.timeline-actors,
.timeline-step {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.timeline-actors {
  padding: 7px 0;
  border-block: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.timeline-actor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-inline: 2px;
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
}

.timeline-actor:not(:last-child) {
  border-inline-end: 1px solid var(--el-border-color-lighter);
}

.timeline-actor .el-icon {
  color: var(--el-text-color-secondary);
  font-size: 15px;
}

.timeline-steps {
  margin: 0;
  padding: 5px 0;
  list-style: none;
  background:
    linear-gradient(var(--el-border-color-lighter), var(--el-border-color-lighter)) 16.6667% 0 / 1px
      100% no-repeat,
    linear-gradient(var(--el-border-color-lighter), var(--el-border-color-lighter)) 50% 0 / 1px 100%
      no-repeat,
    linear-gradient(var(--el-border-color-lighter), var(--el-border-color-lighter)) 83.3333% 0 / 1px
      100% no-repeat;
}

.timeline-step {
  min-height: 29px;
  align-items: center;
}

.timeline-transfer {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 5px 0;
  color: var(--line-confirmed);
  text-align: center;
}

.timeline-transfer-label,
.timeline-unconfirmed {
  background: var(--el-bg-color);
  font-size: 11px;
  line-height: 1.35;
}

.timeline-transfer-label {
  color: var(--el-text-color-primary);
}

.timeline-arrow {
  position: relative;
  width: calc(50% - 4px);
  border-top: 2px solid currentColor;
}

.timeline-arrow::after {
  position: absolute;
  top: -4px;
  width: 6px;
  height: 6px;
  border-top: 2px solid currentColor;
  border-right: 2px solid currentColor;
  content: '';
}

[data-direction='right'] .timeline-arrow::after {
  right: -1px;
  transform: rotate(45deg);
}

[data-direction='left'] .timeline-arrow::after {
  left: -1px;
  transform: rotate(-135deg);
}

[data-confirmed='false'] .timeline-arrow {
  color: var(--line-pending);
  border-top-style: dashed;
}

.timeline-unconfirmed {
  justify-self: end;
  max-width: 50%;
  margin-inline: 2px;
  padding-inline: 1px;
  color: var(--el-text-color-regular);
}

.timeline-point {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 2px 4px;
  z-index: 1;
  justify-self: center;
  max-width: calc(100% - 6px);
  margin-block: 3px;
  padding: 3px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 5px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-size: 11px;
  line-height: 1.35;
  text-align: center;
  text-wrap: balance;
  overflow-wrap: anywhere;
}

.timeline-point:is([data-state='received'], [data-state='success']) .el-icon {
  color: var(--line-confirmed);
}

.timeline-point:is([data-state='timeout'], [data-state='interrupted']) {
  background: var(--el-color-warning-light-9);
  color: var(--step-warning);
}

.timeline-point[data-state='failed'] {
  background: var(--el-color-danger-light-9);
  color: var(--step-danger);
}

.timeline-legend {
  justify-content: center;
  padding: 7px 4px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 11px;
}

.timeline-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.timeline-legend i {
  width: 16px;
  border-top: 2px solid var(--line-confirmed);
}

.timeline-legend span + span i {
  border-top: 2px dashed var(--line-pending);
}

.timeline-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.timeline-metrics div {
  padding: 7px 3px;
  text-align: center;
}

.timeline-metrics div + div {
  border-inline-start: 1px solid var(--el-border-color-lighter);
}

.timeline-metrics dt {
  color: var(--el-text-color-regular);
  font-size: 11px;
}

.timeline-metrics dd {
  margin: 2px 0 0;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
