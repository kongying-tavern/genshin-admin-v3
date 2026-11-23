export type DiagnosticKind = 'attachment' | 'heartbeat' | 'connection' | 'rtt' | 'push'

export type DiagnosticActor = 'page' | 'worker' | 'server'

export type DiagnosticState =
  | 'sent'
  | 'received'
  | 'processing'
  | 'success'
  | 'timeout'
  | 'failed'
  | 'interrupted'
  | 'ended'

export type DiagnosticWait =
  | 'attachment'
  | 'heartbeat'
  | 'connection'
  | 'reply'
  | 'parse'
  | 'receipt'
  | 'processing'

export type DiagnosticLookup =
  | 'marker'
  | 'marker-history'
  | 'linkage'
  | 'item'
  | 'item-history'
  | 'user'

export type DiagnosticStepCode =
  | 'attachment-start'
  | 'attachment-ready'
  | 'attachment-received'
  | 'attachment-failed'
  | 'attachment-timeout'
  | 'ping'
  | 'ping-received'
  | 'pong'
  | 'heartbeat-timeout'
  | 'heartbeat-send-failed'
  | 'connection-start'
  | 'connection-open'
  | 'connection-failed'
  | 'connection-lost'
  | 'connection-ended'
  | 'rtt-send'
  | 'rtt-reply'
  | 'rtt-timeout'
  | 'rtt-interrupted'
  | 'rtt-late-reply'
  | 'rtt-invalid'
  | 'result-forward'
  | 'result-received'
  | 'push-received'
  | 'push-parsed'
  | 'push-invalid'
  | 'push-forward'
  | 'push-page-received'
  | 'receipt-confirmed'
  | 'receipt-timeout'
  | 'forward-failed'
  | 'lookup'
  | 'lookup-result'
  | 'push-dispatched'
  | 'push-processing-failed'
  | 'interrupted'
  | 'session-ended'

export type DiagnosticReason =
  | 'worker-start'
  | 'worker-error'
  | 'initialization-timeout'
  | 'no-pong'
  | 'no-reply'
  | 'no-receipt'
  | 'post-message'
  | 'connect-error'
  | 'transport-close'
  | 'transport-error'
  | 'socket-ping-timeout'
  | 'server-disconnect'
  | 'connection-lost'
  | 'invalid-server-time'
  | 'invalid-message'
  | 'request-failed'
  | 'missing-data'
  | 'processing-failed'
  | 'invalid-details'
  | 'scope-unavailable'
  | 'scope-changed'
  | 'handler-unavailable'
  | 'session-ended'
  | 'session-lost'

export interface DiagnosticIdentity {
  id: string
  accountId: string
  kind: DiagnosticKind
  startedAt: number
  connectionId?: string
  pageId?: string
  event?: WebSocketAPI.WSEventType
}

export interface DiagnosticStep {
  code: DiagnosticStepCode
  from: DiagnosticActor
  to?: DiagnosticActor
  state: DiagnosticState
  time: number
  order: number
  pageId?: string
  reason?: DiagnosticReason
  lookup?: DiagnosticLookup
  waits?: { for: DiagnosticWait; owner: string }
  settles?: DiagnosticWait
}

export interface RttMeasurement {
  id: string
  connectionId: string
  measuredAt: number
  outcome: 'success' | 'timeout' | 'invalid'
  totalMs: number | null
  serverMs: number | null
  roundTripMs: number | null
}

export interface DiagnosticRecord extends DiagnosticIdentity {
  steps: DiagnosticStep[]
  finished: boolean
  completed: 0 | 1
  exceptional: 0 | 1
  firstIssue?: DiagnosticStep
  issueAt?: number
  recoveryAt?: number
  measurement?: RttMeasurement
}

export interface DiagnosticMessage {
  trace: DiagnosticIdentity
  pageId: string
  bindingId: string
}
