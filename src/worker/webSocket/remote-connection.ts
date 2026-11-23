import type {
  DiagnosticIdentity,
  DiagnosticReason,
  DiagnosticStep,
  RttMeasurement,
} from '@/database/websocket/types'
import { io } from 'socket.io-client'
import { WEBSOCKET_WORKER_CONFIG } from '@/configs/websocket'
import {
  diagnosticStep,
  recordDiagnostic,
  recoverDiagnostics,
} from '@/database/websocket/diagnostics'

interface Result {
  trace: DiagnosticIdentity
  measurement: RttMeasurement
}

interface PendingCheck {
  trace: DiagnosticIdentity
  started: number
  timer: ReturnType<typeof setTimeout>
  expire: () => void
}

interface RemoteEvents {
  state: (state: AppSocket.ConnectionState) => void
  result: (result: Result) => DiagnosticStep[]
  message: (connectionId: string, message: unknown) => void
  storageError: () => void
}

const disconnectReasons: Partial<Record<string, DiagnosticReason>> = {
  'ping timeout': 'socket-ping-timeout',
  'transport close': 'transport-close',
  'transport error': 'transport-error',
  'io server disconnect': 'server-disconnect',
}

const { RTT, RECONNECT } = WEBSOCKET_WORKER_CONFIG

export const splitRoundTrip = (
  totalMs: number,
  receiveTimestamp?: number,
  sendTimestamp?: number,
) => {
  const duration =
    typeof sendTimestamp === 'number' && typeof receiveTimestamp === 'number'
      ? sendTimestamp - receiveTimestamp
      : Number.NaN
  const serverMs =
    Number.isFinite(duration) && duration >= 0 && duration <= totalMs ? duration : null
  return { serverMs, roundTripMs: serverMs === null ? null : totalMs - serverMs }
}

export const createRemoteConnection = (
  workerId: string,
  url: string,
  { path, query }: AppSocket.OpenOptions,
  events: RemoteEvents,
) => {
  const accountId = query.userId
  const socket = io(url, {
    path,
    query,
    autoConnect: false,
    forceNew: true,
    transports: ['websocket'],
    reconnectionDelay: RECONNECT.DELAY,
  })

  let stopped = false
  let state: AppSocket.ConnectionState = { status: 'INIT', connectionId: null }
  let attempt: DiagnosticIdentity | undefined
  let latestResult: Result | undefined
  let pending: PendingCheck | undefined
  let nextCheck: ReturnType<typeof setTimeout> | undefined
  const retired = new Map<string, DiagnosticIdentity>()
  const outages: string[] = []
  const missedReplies: string[] = []

  const record = (...args: Parameters<typeof recordDiagnostic>) => {
    void recordDiagnostic(...args).catch(events.storageError)
  }

  const rememberIssue = (issues: string[], id: string) => {
    issues.push(id)
    if (issues.length > 50) issues.shift()
  }

  const recover = (issues: string[], time: number) => {
    if (issues.length)
      void recoverDiagnostics(accountId, issues.splice(0), time).catch(events.storageError)
  }

  const identity = (kind: 'rtt' | 'connection', connectionId?: string): DiagnosticIdentity => {
    const id = crypto.randomUUID()
    return { id, kind, accountId, connectionId: connectionId ?? id, startedAt: Date.now() }
  }

  const changeState = (status: AppSocket.Status, reason?: DiagnosticReason) => {
    state = {
      status,
      connectionId: attempt?.connectionId ?? null,
      changedAt: Date.now(),
      reason,
      lastSuccess: state.lastSuccess,
    }
    events.state(state)
  }

  const beginAttempt = () => {
    attempt = identity('connection')
    latestResult = undefined
    record(attempt, [
      diagnosticStep('connection-start', 'worker', 'sent', {
        to: 'server',
        waits: { for: 'connection', owner: workerId },
      }),
    ])
    changeState('CONNECTING')
  }

  const retirePending = (check: PendingCheck) => {
    clearTimeout(check.timer)
    pending = undefined
    retired.set(check.trace.id, check.trace)
    if (retired.size > 100) retired.delete(retired.keys().next().value!)
  }

  const publishResult = (
    trace: DiagnosticIdentity,
    steps: DiagnosticStep[],
    measurement: RttMeasurement,
  ) => {
    latestResult = { trace, measurement }
    if (measurement.outcome === 'success') state = { ...state, lastSuccess: measurement }
    record(trace, [...steps, ...events.result(latestResult)], { finished: true, measurement })
  }

  const timeOut = (check: PendingCheck) => {
    retirePending(check)
    const timeout = diagnosticStep('rtt-timeout', 'worker', 'timeout', {
      reason: 'no-reply',
      settles: 'reply',
    })
    const measurement: RttMeasurement = {
      id: check.trace.id,
      connectionId: check.trace.connectionId!,
      measuredAt: timeout.time,
      outcome: 'timeout',
      totalMs: null,
      serverMs: null,
      roundTripMs: null,
    }
    rememberIssue(missedReplies, check.trace.id)
    publishResult(check.trace, [timeout], measurement)
  }

  const runCheck = () => {
    nextCheck = undefined
    if (stopped || !socket.connected || !attempt || pending) return
    const trace = identity('rtt', attempt.connectionId)
    const send = diagnosticStep('rtt-send', 'worker', 'sent', {
      to: 'server',
      waits: { for: 'reply', owner: workerId },
    })
    const started = performance.now()
    const expire = () => {
      if (pending?.trace.id !== trace.id) return
      timeOut(pending)
      nextCheck = setTimeout(runCheck, RTT.INTERVAL)
    }
    const timer = setTimeout(expire, RTT.TIMEOUT)
    pending = { trace, started, timer, expire }
    socket.emit('rttcheck', { id: trace.id })
    record(trace, [send])
  }

  const stopChecks = (normal: boolean) => {
    clearTimeout(nextCheck)
    nextCheck = undefined
    latestResult = undefined
    missedReplies.length = 0
    if (!pending) return
    const check = pending
    retirePending(check)
    record(
      check.trace,
      [
        diagnosticStep('rtt-interrupted', 'worker', normal ? 'ended' : 'interrupted', {
          reason: normal ? 'session-ended' : 'connection-lost',
          settles: 'reply',
        }),
      ],
      { finished: true },
    )
  }

  socket.on('rttcheck', (feedback: AppSocket.SocketEventMap['rttcheck'][0]) => {
    const received = performance.now()
    if (!feedback || typeof feedback.id !== 'string') return
    const { id, receiveTimestamp, sendTimestamp } = feedback
    const check = pending
    if (check?.trace.id === id && received - check.started >= RTT.TIMEOUT) check.expire()

    if (
      pending?.trace.id !== id
      || !socket.connected
      || pending.trace.connectionId !== attempt?.connectionId
    ) {
      const trace = retired.get(id)
      if (trace) {
        retired.delete(id)
        record(trace, [diagnosticStep('rtt-late-reply', 'server', 'received', { to: 'worker' })], {
          existingOnly: true,
        })
      }
      return
    }

    const totalMs = received - pending.started
    const trace = pending.trace
    clearTimeout(pending.timer)
    pending = undefined
    const reply = diagnosticStep('rtt-reply', 'server', 'received', {
      to: 'worker',
      settles: 'reply',
    })
    const timing = splitRoundTrip(totalMs, receiveTimestamp, sendTimestamp)
    const measurement: RttMeasurement = {
      id,
      connectionId: trace.connectionId!,
      measuredAt: reply.time,
      outcome: timing.serverMs === null ? 'invalid' : 'success',
      totalMs,
      ...timing,
    }
    const steps = [reply]
    if (timing.serverMs === null)
      steps.push(
        diagnosticStep('rtt-invalid', 'worker', 'failed', { reason: 'invalid-server-time' }),
      )
    publishResult(trace, steps, measurement)
    recover(missedReplies, reply.time)
    nextCheck = setTimeout(runCheck, RTT.INTERVAL)
  })

  socket.on('message', (message: unknown) => {
    if (!stopped && socket.connected && attempt?.connectionId)
      events.message(attempt.connectionId, message)
  })

  socket.io.on('reconnect_attempt', beginAttempt)

  socket.on('connect', () => {
    if (stopped || !attempt) return
    const step = diagnosticStep('connection-open', 'server', 'received', {
      to: 'worker',
      settles: 'connection',
    })
    record(attempt, [step], { finished: true })
    recover(outages, step.time)
    changeState('OPEN')
    runCheck()
  })

  const failConnection = () => {
    if (stopped || !attempt) return
    rememberIssue(outages, attempt.id)
    record(
      attempt,
      [
        diagnosticStep('connection-failed', 'worker', 'failed', {
          reason: 'connect-error',
          settles: 'connection',
        }),
      ],
      { finished: true },
    )
    changeState('CLOSED', 'connect-error')
  }
  socket.on('connect_error', failConnection)

  socket.on('disconnect', reason => {
    if (stopped || !attempt) return
    stopChecks(false)
    const lost = identity('connection', attempt.connectionId)
    const cause = disconnectReasons[reason] ?? 'connection-lost'
    rememberIssue(outages, lost.id)
    record(lost, [diagnosticStep('connection-lost', 'worker', 'interrupted', { reason: cause })], {
      finished: true,
    })
    changeState('CLOSED', cause)
  })

  return {
    get state() {
      return state
    },
    get latestResult() {
      return latestResult
    },
    connect: () => {
      if (!socket.connected && !socket.active) {
        beginAttempt()
        try {
          socket.connect()
        } catch {
          failConnection()
        }
      }
    },
    close: () => {
      stopped = true
      stopChecks(true)
      if (attempt) {
        const ending =
          state.status === 'CONNECTING' ? attempt : identity('connection', attempt.connectionId)
        record(
          ending,
          [
            diagnosticStep('connection-ended', 'worker', 'ended', {
              reason: 'session-ended',
              settles: 'connection',
            }),
          ],
          { finished: true },
        )
      }
      socket.disconnect()
    },
  }
}
