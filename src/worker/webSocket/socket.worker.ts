import type {
  DiagnosticIdentity,
  DiagnosticMessage,
  DiagnosticStep,
} from '@/database/websocket/types'
import { parseSocketEvent } from '@/api/ws/events'
import { WEBSOCKET_WORKER_CONFIG } from '@/configs/websocket'
import {
  diagnosticStep,
  endDiagnosticSession,
  interruptStaleDiagnostics,
  liveDiagnosticSessions,
  recordDiagnostic,
  recoverDiagnostics,
  trackDiagnosticSession,
} from '@/database/websocket/diagnostics'
import { WorkerIPC } from '@/utils/worker/worker-ipc'
import { createRemoteConnection } from './remote-connection'

declare const globalThis: WorkerGlobalScope

type Timer = ReturnType<typeof setTimeout>
type SocketIPC = WorkerIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap, DiagnosticMessage>
type RemoteConnection = ReturnType<typeof createRemoteConnection>

interface Connection {
  accountId: string
  key: string
  remote: RemoteConnection
  ports: Set<PagePort>
}

interface Heartbeat {
  id: string
  trace?: DiagnosticIdentity
  timer?: Timer
  deadline?: number
  expire?: () => void
}

interface Delivery {
  trace: DiagnosticIdentity
  timer?: Timer
  acknowledged?: true
}

interface PagePort {
  id: string
  ipc: SocketIPC
  dispose?: () => void
  sessionId?: string
  bindingId?: string
  connection?: Connection
  reachable: boolean
  heartbeatTimer?: Timer
  heartbeat?: Heartbeat
  missedHeartbeats: Map<string, DiagnosticIdentity>
  deliveries: Map<string, Delivery>
}

const { HEARTBEAT, IPC_TIMEOUT } = WEBSOCKET_WORKER_CONFIG
const workerId = crypto.randomUUID()
trackDiagnosticSession(workerId)

const ports = new Set<PagePort>()
const connections = new Map<string, Connection>()
const incompleteAccounts = new Set<string>()

const safelySend = (send: () => void) => {
  try {
    send()
    return true
  } catch {
    return false
  }
}

const storageError = (accountId: string) => {
  if (incompleteAccounts.has(accountId)) return
  incompleteAccounts.add(accountId)
  for (const port of ports) {
    if (port.connection?.accountId === accountId)
      safelySend(() => port.ipc.emit('storageError', accountId))
  }
}

const record = (...args: Parameters<typeof recordDiagnostic>) => {
  void recordDiagnostic(...args).catch(() => storageError(args[0].accountId))
}

const retireDeliveries = (port: PagePort) => {
  while (port.deliveries.size > 150) {
    const settled = [...port.deliveries.values()].find(delivery => delivery.timer === undefined)
    if (!settled) return
    port.deliveries.delete(settled.trace.id)
  }
}

const deliver = <C extends WebSocketAPI.WSEventType | 'rttResult'>(
  port: PagePort,
  trace: DiagnosticIdentity,
  channel: C,
  ...args: AppSocket.WorkerEventMap[C]['args']
): DiagnosticStep[] => {
  if (!port.bindingId) return []
  const metadata = { trace, pageId: port.id, bindingId: port.bindingId }
  const send = () => port.ipc.emitWithMetadata(metadata, channel, ...args)
  if (port.deliveries.has(trace.id)) {
    safelySend(send)
    return []
  }

  const forward = diagnosticStep(
    channel === 'rttResult' ? 'result-forward' : 'push-forward',
    'worker',
    'sent',
    {
      pageId: port.id,
      to: 'page',
      waits: { for: 'receipt', owner: workerId },
    },
  )
  if (!safelySend(send)) {
    return [
      forward,
      diagnosticStep('forward-failed', 'worker', 'failed', {
        pageId: port.id,
        reason: 'post-message',
        settles: 'receipt',
      }),
    ]
  }

  const delivery: Delivery = { trace }
  delivery.timer = setTimeout(() => {
    delivery.timer = undefined
    record(trace, [
      diagnosticStep('receipt-timeout', 'worker', 'timeout', {
        pageId: port.id,
        reason: 'no-receipt',
        settles: 'receipt',
      }),
    ])
    retireDeliveries(port)
  }, IPC_TIMEOUT)
  port.deliveries.set(trace.id, delivery)
  return [forward]
}

const sendConnectionState = (port: PagePort, state: AppSocket.ConnectionState) => {
  const { bindingId } = port
  if (bindingId) safelySend(() => port.ipc.emit('connectionState', bindingId, state))
}

const sendSnapshot = (port: PagePort) => {
  const connection = port.connection
  if (!connection) return
  sendConnectionState(port, connection.remote.state)
  if (incompleteAccounts.has(connection.accountId))
    safelySend(() => port.ipc.emit('storageError', connection.accountId))
  const result = connection.remote.latestResult
  if (result) {
    const steps = deliver(port, result.trace, 'rttResult', result.measurement)
    if (steps.length) record(result.trace, steps, { existingOnly: true })
  }
}

const onSocketMessage = (
  accountId: string,
  members: Set<PagePort>,
  connectionId: string,
  message: unknown,
) => {
  const trace: DiagnosticIdentity = {
    id: crypto.randomUUID(),
    accountId,
    kind: 'push',
    connectionId,
    startedAt: Date.now(),
  }
  record(trace, [
    diagnosticStep('push-received', 'server', 'received', {
      to: 'worker',
      waits: { for: 'parse', owner: workerId },
    }),
  ])
  let payload
  try {
    payload = parseSocketEvent(message)
  } catch {
    record(
      trace,
      [
        diagnosticStep('push-invalid', 'worker', 'failed', {
          reason: 'invalid-message',
          settles: 'parse',
        }),
      ],
      { finished: true },
    )
    return
  }

  const { event, args } = payload
  const parsed = { ...trace, event }
  const steps = [diagnosticStep('push-parsed', 'worker', 'success', { settles: 'parse' })]
  for (const port of members) {
    if (port.reachable) {
      steps.push(...deliver(port, parsed, event, ...args))
    } else {
      steps.push(
        diagnosticStep('forward-failed', 'worker', 'failed', {
          pageId: port.id,
          reason: 'no-pong',
        }),
      )
    }
  }
  record(parsed, steps, { finished: true })
}

const getConnection = (url: string, options: AppSocket.OpenOptions, key: string): Connection => {
  const current = connections.get(key)
  if (current) return current

  const accountId = options.query.userId
  const members = new Set<PagePort>()
  const remote = createRemoteConnection(workerId, url, options, {
    state: state => {
      for (const port of members) sendConnectionState(port, state)
    },
    result: ({ trace, measurement }) =>
      [...members].flatMap(port =>
        port.reachable ? deliver(port, trace, 'rttResult', measurement) : [],
      ),
    message: (id, message) => onSocketMessage(accountId, members, id, message),
    storageError: () => storageError(accountId),
  })
  const connection = { accountId, key, remote, ports: members }
  connections.set(key, connection)
  return connection
}

const cancelHeartbeat = (port: PagePort, normal: boolean) => {
  clearTimeout(port.heartbeatTimer)
  port.heartbeatTimer = undefined
  const beat = port.heartbeat
  port.heartbeat = undefined
  clearTimeout(beat?.timer)
  if (beat?.trace) {
    record(
      beat.trace,
      [
        diagnosticStep(
          normal ? 'session-ended' : 'interrupted',
          'worker',
          normal ? 'ended' : 'interrupted',
          {
            reason: normal ? 'session-ended' : 'session-lost',
            settles: 'heartbeat',
          },
        ),
      ],
      { finished: true },
    )
  }
}

const leaveConnection = (port: PagePort, normal = true) => {
  const connection = port.connection
  if (!connection) return
  cancelHeartbeat(port, normal)
  for (const { timer, trace } of port.deliveries.values()) {
    clearTimeout(timer)
    if (timer !== undefined) {
      record(trace, [
        diagnosticStep(
          normal ? 'session-ended' : 'interrupted',
          'worker',
          normal ? 'ended' : 'interrupted',
          {
            pageId: port.id,
            reason: normal ? 'session-ended' : 'session-lost',
            settles: 'receipt',
          },
        ),
      ])
    }
  }
  port.deliveries.clear()
  port.connection = undefined
  port.bindingId = undefined
  port.missedHeartbeats.clear()
  connection.ports.delete(port)
  if (!connection.ports.size) {
    connections.delete(connection.key)
    connection.remote.close()
  }
}

const detach = (port: PagePort, normal: boolean) => {
  const accountId = port.connection?.accountId
  if (accountId && port.sessionId) {
    void endDiagnosticSession(accountId, port.sessionId, normal).catch(() =>
      storageError(accountId),
    )
  }
  if (normal && accountId) {
    const ended = diagnosticStep('session-ended', 'page', 'ended', { reason: 'session-ended' })
    record(
      {
        id: crypto.randomUUID(),
        accountId,
        pageId: port.id,
        kind: 'attachment',
        startedAt: ended.time,
      },
      [ended],
      { finished: true },
    )
  }
  leaveConnection(port, normal)
  cancelHeartbeat(port, normal)
  ports.delete(port)
  port.dispose?.()
}

const sendPing = (port: PagePort) => {
  if (port.heartbeat || !port.sessionId) return

  const id = crypto.randomUUID()
  const accountId = port.connection?.accountId
  const trace: DiagnosticIdentity | undefined = accountId
    ? { id, accountId, kind: 'heartbeat', startedAt: Date.now(), pageId: port.id }
    : undefined
  const ping = diagnosticStep('ping', 'worker', 'sent', {
    to: 'page',
    waits: { for: 'heartbeat', owner: workerId },
  })
  const beat: Heartbeat = { id, trace }
  const miss = (sent: boolean) => {
    clearTimeout(beat.timer)
    port.heartbeat = undefined
    port.reachable = false
    if (trace) {
      if (sent) {
        port.missedHeartbeats.set(id, trace)
        if (port.missedHeartbeats.size > 50)
          port.missedHeartbeats.delete(port.missedHeartbeats.keys().next().value!)
      }
      record(
        trace,
        [
          ping,
          diagnosticStep(
            sent ? 'heartbeat-timeout' : 'heartbeat-send-failed',
            'worker',
            sent ? 'timeout' : 'failed',
            {
              reason: sent ? 'no-pong' : 'post-message',
              settles: 'heartbeat',
            },
          ),
        ],
        { finished: true },
      )
    }
  }
  if (!safelySend(() => port.ipc.emit('ping', id, trace))) {
    miss(false)
    return
  }
  beat.expire = () => miss(true)
  beat.deadline = performance.now() + HEARTBEAT.TIMEOUT
  beat.timer = setTimeout(beat.expire, HEARTBEAT.TIMEOUT)
  port.heartbeat = beat
  if (trace) record(trace, [ping])
}

const scheduleHeartbeat = (port: PagePort) => {
  clearTimeout(port.heartbeatTimer)
  port.heartbeatTimer = setTimeout(() => {
    port.heartbeatTimer = undefined
    sendPing(port)
  }, HEARTBEAT.INTERVAL)
}

const onPong = (port: PagePort, id: string) => {
  const current = port.heartbeat
  if (current?.id === id && current.deadline !== undefined && performance.now() >= current.deadline)
    current.expire?.()
  const beat = port.heartbeat?.id === id ? port.heartbeat : undefined
  const missed = port.missedHeartbeats.get(id)
  if (!beat && !missed) return

  const pong = diagnosticStep('pong', 'page', 'received', { to: 'worker', settles: 'heartbeat' })
  const trace = beat?.trace ?? missed
  if (trace) record(trace, [pong], { finished: true, existingOnly: missed ? true : undefined })
  if (port.heartbeat && !beat) return
  clearTimeout(beat?.timer)
  port.heartbeat = undefined
  if (!port.reachable) {
    const accountId = port.connection?.accountId
    if (accountId) {
      const ids = Array.from(port.missedHeartbeats.keys())
      void recoverDiagnostics(accountId, ids, pong.time).catch(() => storageError(accountId))
    }
    port.reachable = true
    sendSnapshot(port)
  }
  port.missedHeartbeats.delete(id)
  scheduleHeartbeat(port)
}

const registerPort = (
  messagePort: MessagePort | DedicatedWorkerGlobalScope,
  dispose?: () => void,
) => {
  const ipc = new WorkerIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap, DiagnosticMessage>(
    messagePort,
  )
  const port: PagePort = {
    id: crypto.randomUUID(),
    ipc,
    dispose,
    reachable: true,
    deliveries: new Map(),
    missedHeartbeats: new Map(),
  }
  ports.add(port)

  ipc.handle('attach', attemptId => {
    port.sessionId = attemptId
    const ready = diagnosticStep('attachment-ready', 'worker', 'sent', { to: 'page' })
    ipc.emit('init', port.id, attemptId, ready)
    scheduleHeartbeat(port)
  })

  ipc.handle('open', (url, options) => {
    const accountId = options.query.userId
    const key = JSON.stringify([url, options.path, accountId, options.query.token])
    if (port.connection?.key !== key) leaveConnection(port)
    const reused = connections.has(key)
    const connection = getConnection(url, options, key)
    connection.ports.add(port)
    port.connection = connection
    port.bindingId = options.bindingId
    port.reachable = true
    if (!port.heartbeat && port.heartbeatTimer === undefined) scheduleHeartbeat(port)
    sendSnapshot(port)
    connection.remote.connect()
    return reused ? 'reused' : 'created'
  })

  ipc.handle('close', () => {
    leaveConnection(port)
    scheduleHeartbeat(port)
  })
  ipc.handle('detach', () => detach(port, true))
  ipc.handle('resume', () => {
    if (!port.reachable) sendPing(port)
    else sendSnapshot(port)
  })
  ipc.handle('pong', id => onPong(port, id))
  ipc.handle('receipt', (id, pageId) => {
    const delivery = port.deliveries.get(id)
    if (pageId !== port.id || !delivery || delivery.acknowledged) return
    const timedOut = delivery.timer === undefined
    clearTimeout(delivery.timer)
    delivery.timer = undefined
    delivery.acknowledged = true
    record(
      delivery.trace,
      [
        diagnosticStep('receipt-confirmed', 'page', 'received', {
          to: 'worker',
          pageId,
          settles: 'receipt',
        }),
      ],
      timedOut ? { existingOnly: true } : undefined,
    )
    retireDeliveries(port)
  })
}

setInterval(async () => {
  const sessions = await liveDiagnosticSessions()
  for (const port of ports) {
    if (!port.reachable && sessions && port.sessionId && !sessions.has(port.sessionId))
      detach(port, false)
  }
  const accounts = new Set([...connections.values()].map(connection => connection.accountId))
  for (const accountId of accounts)
    void interruptStaleDiagnostics(accountId).catch(() => storageError(accountId))
}, 60000)

if (Object.prototype.toString.call(globalThis) === '[object SharedWorkerGlobalScope]') {
  const scope = globalThis as SharedWorkerGlobalScope
  scope.addEventListener('connect', ({ ports: [port] }) => {
    registerPort(port, () => port.close())
    port.start()
  })
} else {
  registerPort(globalThis as DedicatedWorkerGlobalScope)
}
