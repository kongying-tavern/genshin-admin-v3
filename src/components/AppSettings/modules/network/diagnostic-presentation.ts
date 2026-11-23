import type {
  DiagnosticActor,
  DiagnosticKind,
  DiagnosticLookup,
  DiagnosticReason,
  DiagnosticRecord,
  DiagnosticStep,
  DiagnosticStepCode,
} from '@/database/websocket/types'
import { SOCKET_EVENT_LABELS } from '@/api/ws/events'
import { isDiagnosticIssue, waitingSteps } from '@/database/websocket/diagnostics'

export const ACTOR_LABELS: Record<DiagnosticActor, string> = {
  page: '当前页面',
  worker: '浏览器后台',
  server: '服务器',
}

const KIND_LABELS: Record<DiagnosticKind, string> = {
  attachment: '页面接入',
  heartbeat: '页面心跳',
  connection: '服务器连接',
  rtt: '连接检测',
  push: '服务器推送',
}

const STEP_LABELS: Record<DiagnosticStepCode, string> = {
  'attachment-start': '请求接入后台',
  'attachment-ready': '发送初始化回应',
  'attachment-received': '本页已接入后台',
  'attachment-failed': '本页未能启动连接后台',
  'attachment-timeout': '等待浏览器后台回应超时',
  ping: '发送页面心跳',
  'ping-received': '本页收到心跳',
  pong: '后台收到心跳回应',
  'heartbeat-timeout': '等待本页心跳回应超时',
  'heartbeat-send-failed': '页面心跳发送失败',
  'connection-start': '尝试建立连接',
  'connection-open': '服务器连接已建立',
  'connection-failed': '建立服务器连接失败',
  'connection-lost': '服务器连接中断',
  'connection-ended': '连接已结束',
  'rtt-send': '发送连接检测',
  'rtt-reply': '后台收到检测回复',
  'rtt-timeout': '等待服务器回复超时',
  'rtt-interrupted': '检测已结束',
  'rtt-late-reply': '后台收到迟到回复',
  'rtt-invalid': '服务器计时无效',
  'result-forward': '转发检测结果',
  'result-received': '检测结果已到本页',
  'push-received': '后台收到推送',
  'push-parsed': '已读取通知',
  'push-invalid': '读取通知内容失败',
  'push-forward': '转交通知到本页',
  'push-page-received': '通知已到本页',
  'receipt-confirmed': '后台收到页面确认',
  'receipt-timeout': '后台等待页面确认超时',
  'forward-failed': '转交页面失败',
  lookup: '读取详情',
  'lookup-result': '详情读取结果',
  'push-dispatched': '已交给页面处理',
  'push-processing-failed': '页面处理失败',
  interrupted: '过程中断，后续待确认',
  'session-ended': '页面会话已结束',
}

const LOOKUP_LABELS: Record<DiagnosticLookup, { title: string; missing: string }> = {
  marker: { title: '点位详情', missing: '未找到点位' },
  'marker-history': { title: '点位历史', missing: '未找到点位历史' },
  linkage: { title: '关联详情', missing: '未找到关联' },
  item: { title: '物品详情', missing: '未找到物品' },
  'item-history': { title: '物品历史', missing: '未找到物品历史' },
  user: { title: '用户信息', missing: '未找到用户' },
}

const EVIDENCE: Partial<Record<DiagnosticStepCode, DiagnosticStepCode[]>> = {
  'attachment-start': ['attachment-ready'],
  'attachment-ready': ['attachment-received'],
  ping: ['ping-received', 'pong'],
  'connection-start': ['connection-open'],
  'rtt-send': ['rtt-reply', 'rtt-late-reply'],
  'push-forward': ['push-page-received', 'receipt-confirmed'],
  'result-forward': ['result-received', 'receipt-confirmed'],
}

export const REASON_LABELS: Record<DiagnosticReason, string> = {
  'worker-start': '浏览器未能创建工作线程',
  'worker-error': '浏览器后台报告运行错误',
  'initialization-timeout': '等待期间没有收到初始化消息',
  'no-pong': '页面没有按时返回心跳回应',
  'no-reply': '检测时限内没有收到匹配的回复',
  'no-receipt': '时限内没有收到页面的送达回执',
  'post-message': '浏览器拒绝发送这次消息',
  'connect-error': 'Socket.IO 未能建立连接',
  'transport-close': '底层传输连接已关闭',
  'transport-error': '底层传输发生错误',
  'socket-ping-timeout': 'Socket.IO 心跳超时',
  'server-disconnect': '服务器关闭了连接',
  'connection-lost': '服务器连接已中断',
  'invalid-server-time': '回包时间戳缺失或计算出的服务器处理耗时无效',
  'invalid-message': '消息格式或事件参数无效',
  'request-failed': '详情请求失败',
  'missing-data': '详情请求返回了空结果',
  'processing-failed': '页面未能处理或分发通知',
  'invalid-details': '历史详情的格式无效',
  'scope-unavailable': '本页的账号凭证或地图数据作用域尚未就绪',
  'scope-changed': '当前页面已切换地图数据作用域',
  'handler-unavailable': '本页尚未监听这类通知',
  'session-ended': '页面会话正常结束',
  'session-lost': '通信过程中所属的页面或后台会话已失效',
}

const fullTime = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
const milliseconds = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
  useGrouping: false,
})

export const formatDiagnosticTime = (time: number) => fullTime.format(time)

export const formatMilliseconds = (value: number | null | undefined) =>
  value == null ? '—' : `${milliseconds.format(value)} ms`

export const recordLabel = (record: DiagnosticRecord) =>
  record.event ? SOCKET_EVENT_LABELS[record.event] : KIND_LABELS[record.kind]

export const stepLabel = (step: DiagnosticStep) => {
  if (step.code === 'rtt-interrupted' && step.state === 'interrupted') return '检测中断'
  if (!step.lookup) return STEP_LABELS[step.code]

  const { title, missing } = LOOKUP_LABELS[step.lookup]
  if (step.code === 'lookup') return `读取${title}`
  if (step.reason === 'missing-data') return missing
  return step.state === 'failed' ? `读取${title}失败` : `已取得${title}`
}

export const isConfirmed = (step: DiagnosticStep, steps: DiagnosticStep[]) =>
  step.state === 'received' || steps.some(other => EVIDENCE[step.code]?.includes(other.code))

const ISSUE_STATUS = {
  timeout: { label: '超时', tone: 'warning' },
  interrupted: { label: '中断', tone: 'warning' },
  failed: { label: '失败', tone: 'danger' },
} as const

export const recordStatus = (record: DiagnosticRecord, steps?: DiagnosticStep[]) => {
  const issue = steps ? steps.find(isDiagnosticIssue) : record.firstIssue
  if (issue && record.recoveryAt !== undefined) return { label: '已恢复', tone: 'positive' }
  if (issue && issue.state in ISSUE_STATUS)
    return ISSUE_STATUS[issue.state as keyof typeof ISSUE_STATUS]
  const completed = steps ? record.finished && !waitingSteps(steps).length : record.completed
  if (!completed) return { label: '进行中', tone: 'warning' }
  if ((steps ?? record.steps).some(step => step.state === 'ended'))
    return { label: '已结束', tone: 'neutral' }
  return { label: '已完成', tone: 'positive' }
}

export const pageIdsFor = (record: DiagnosticRecord) =>
  Array.from(
    new Set(
      [record.pageId, ...record.steps.map(step => step.pageId)].filter((id): id is string => !!id),
    ),
  )

export const issuePageLabel = (record: DiagnosticRecord, pageId: string) => {
  const sessionId = record.firstIssue?.pageId ?? record.pageId
  if (sessionId) return sessionId === pageId ? '本页' : `页面 ${sessionId.slice(0, 8)}`
  if (record.kind === 'attachment') return `页面 ${record.id.slice(0, 8)}`
}

export interface DiagnosticGroup {
  record: DiagnosticRecord
  ids: string[]
}

const routineKey = (record: DiagnosticRecord) => {
  if (record.exceptional || !record.completed || record.steps.some(step => step.state === 'ended'))
    return undefined
  if (record.kind === 'rtt' && record.measurement?.outcome === 'success')
    return `rtt:${record.connectionId}`
  if (record.kind === 'heartbeat') return `heartbeat:${record.pageId}`
}

export const groupDiagnostics = (records: DiagnosticRecord[]): DiagnosticGroup[] => {
  const groups: DiagnosticGroup[] = []
  const routine = new Map<string, DiagnosticGroup>()
  for (const record of records) {
    const key = routineKey(record)
    const group = key ? routine.get(key) : undefined
    if (group) {
      group.ids.push(record.id)
      continue
    }
    const next = { record, ids: [record.id] }
    groups.push(next)
    if (key) routine.set(key, next)
    else routine.clear()
  }
  return groups
}
