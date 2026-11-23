import type {
  DiagnosticIdentity,
  DiagnosticMessage,
  DiagnosticStep,
} from '@/database/websocket/types'
import { WEBSOCKET_WORKER_CONFIG } from '@/configs/websocket'
import {
  diagnosticStep,
  endDiagnosticSession,
  interruptStaleDiagnostics,
  recordDiagnostic,
  trackDiagnosticSession,
} from '@/database/websocket/diagnostics'
import { useUserStore } from '@/stores/user'
import { EventBus } from '@/utils'
import { PageIPC } from '@/utils/worker'
import SocketWorkerURL from '@/worker/webSocket/socket.worker?worker&url'

export type SocketPageIPC = PageIPC<
  AppSocket.MainEventMap,
  AppSocket.WorkerEventMap,
  DiagnosticMessage
>
export type RecordPageStep = (metadata: DiagnosticMessage | undefined, step: DiagnosticStep) => void

interface SocketBinding {
  id: string
  accountId: string
  token?: string
  opening?: Promise<void>
}

export const useSocket = () => {
  const context = ref<AppSocket.MainContext>({
    id: '',
    accountId: null,
    status: 'INIT',
    connectionId: null,
    attachment: 'starting',
    measurement: null,
    get delay() {
      return this.measurement?.roundTripMs ?? null
    },
    diagnosticsIncomplete: false,
  })
  const socketEvent = new EventBus<WebSocketAPI.WSEventMap>()
  const incompleteAccounts = new Set<string>()
  const attachmentId = crypto.randomUUID()
  const attachment = Promise.withResolvers<boolean>()
  const started = diagnosticStep('attachment-start', 'page', 'sent', {
    to: 'worker',
    waits: { for: 'attachment', owner: attachmentId },
  })
  const attachmentSteps = [started]
  const releaseSession = trackDiagnosticSession(attachmentId)
  let attachmentAccount: string | undefined
  let attachmentRecoveredAt: number | undefined
  let attachmentTimer: ReturnType<typeof setTimeout> | undefined
  let socketWorker: SharedWorker | Worker | undefined
  let binding: SocketBinding | undefined

  const storageError = (accountId: string) => {
    incompleteAccounts.add(accountId)
    if (context.value.accountId === accountId) context.value.diagnosticsIncomplete = true
  }

  const record = (...args: Parameters<typeof recordDiagnostic>) => {
    void recordDiagnostic(...args).catch(() => storageError(args[0].accountId))
  }

  const attachmentTrace = (): DiagnosticIdentity | undefined =>
    attachmentAccount
      ? {
          id: attachmentId,
          accountId: attachmentAccount,
          kind: 'attachment',
          startedAt: started.time,
          ...(context.value.id ? { pageId: context.value.id } : {}),
        }
      : undefined

  const saveAttachment = () => {
    const trace = attachmentTrace()
    if (trace) {
      record(trace, [...attachmentSteps], {
        finished: context.value.attachment === 'starting' ? undefined : true,
        recoveryAt: attachmentRecoveredAt,
      })
    }
  }

  const failAttachment = (
    status: 'timeout' | 'failed',
    reason: 'worker-start' | 'worker-error' | 'initialization-timeout',
  ) => {
    clearTimeout(attachmentTimer)
    // 保留等待中的请求，以便收到迟到的初始化消息后接入当前凭证。
    if (status === 'failed') attachment.resolve(false)
    context.value.attachment = status
    context.value.status = 'CLOSED'
    context.value.measurement = null
    attachmentSteps.push(
      diagnosticStep(
        status === 'timeout' ? 'attachment-timeout' : 'attachment-failed',
        'page',
        status,
        {
          reason,
          settles: 'attachment',
        },
      ),
    )
    saveAttachment()
  }

  try {
    const WorkerType = typeof SharedWorker === 'function' ? SharedWorker : Worker
    socketWorker = new WorkerType(SocketWorkerURL, { type: 'module', name: 'Socket 工作线程' })
  } catch {
    failAttachment('failed', 'worker-start')
  }

  const messagePort = socketWorker && ('port' in socketWorker ? socketWorker.port : socketWorker)
  const ipc: SocketPageIPC = new PageIPC(messagePort, ({ metadata }, hasListeners) => {
    if (!metadata) return
    if (metadata.bindingId !== binding?.id || metadata.pageId !== context.value.id) return false
    const { trace, pageId } = metadata
    if (trace.kind === 'rtt') {
      record(trace, [diagnosticStep('result-received', 'page', 'received', { pageId })])
    } else {
      const steps = [
        diagnosticStep('push-page-received', 'page', 'received', {
          pageId,
          waits: { for: 'processing', owner: attachmentId },
        }),
      ]
      if (!hasListeners) {
        steps.push(
          diagnosticStep('interrupted', 'page', 'interrupted', {
            pageId,
            reason: 'handler-unavailable',
            settles: 'processing',
          }),
        )
      }
      record(trace, steps)
    }
    try {
      ipc.send('receipt', trace.id, pageId)
    } catch {
      // 后台会记录等待送达回执的结果。
    }
  })

  const recordPageStep: RecordPageStep = (metadata, step) => {
    if (metadata) record(metadata.trace, [{ ...step, pageId: metadata.pageId }])
  }

  ipc.on('init', (id, attemptId, ready) => {
    if (attemptId !== attachmentId || context.value.id) return
    const recovered =
      context.value.attachment === 'timeout' || context.value.attachment === 'failed'
    clearTimeout(attachmentTimer)
    context.value.id = id
    context.value.attachment = 'ready'
    const received = diagnosticStep('attachment-received', 'page', 'received', {
      settles: 'attachment',
    })
    if (recovered) attachmentRecoveredAt = received.time
    attachmentSteps.push(ready, received)
    saveAttachment()
    attachment.resolve(true)
  })

  ipc.on('connectionState', (bindingId, state) => {
    if (bindingId !== binding?.id) return
    if (state.connectionId !== context.value.connectionId || state.status !== 'OPEN')
      context.value.measurement = null
    Object.assign(context.value, state)
  })

  ipc.on('rttResult', measurement => {
    if (context.value.status !== 'OPEN' || measurement.connectionId !== context.value.connectionId)
      return
    context.value.measurement = measurement
    if (measurement.outcome === 'success') context.value.lastSuccess = measurement
  })

  ipc.on('storageError', storageError)

  ipc.on('ping', (id, trace) => {
    if (trace?.accountId === context.value.accountId && trace)
      record(trace, [diagnosticStep('ping-received', 'page', 'received')])
    try {
      ipc.send('pong', id)
    } catch {
      // 后台会按心跳时限记录结果。
    }
  })

  const endPageSession = (accountId: string) => {
    void endDiagnosticSession(accountId, attachmentId, true).catch(() => storageError(accountId))
  }

  const setAccount = (accountId: string | null) => {
    const previous = context.value.accountId
    if (previous && previous !== accountId) endPageSession(previous)
    Object.assign(context.value, {
      accountId,
      status: accountId && context.value.attachment === 'starting' ? 'INIT' : 'CLOSED',
      connectionId: null,
      changedAt: undefined,
      reason: undefined,
      lastSuccess: undefined,
      measurement: null,
      diagnosticsIncomplete: !!accountId && incompleteAccounts.has(accountId),
    })
  }

  const open = (accountId: string) => {
    const { accessToken } = useUserStore().auth
    if (binding?.accountId !== accountId || binding.token !== accessToken) {
      binding = { id: crypto.randomUUID(), accountId, token: accessToken }
      setAccount(accountId)
      if (!attachmentAccount) {
        attachmentAccount = accountId
        saveAttachment()
      }
      void interruptStaleDiagnostics(accountId).catch(() => storageError(accountId))
    }

    const current = binding
    if (current.opening) return current.opening
    const opening = (async () => {
      const ready = await attachment.promise
      if (binding !== current) return
      if (!ready || context.value.attachment !== 'ready') throw new Error('浏览器后台未接入')
      try {
        const url = new URL(import.meta.env.VITE_WS_BASE)
        await ipc.invoke('open', url.origin, {
          path: url.pathname,
          bindingId: current.id,
          query: { userId: accountId, ...(current.token ? { token: current.token } : {}) },
        })
      } catch (cause) {
        if (binding === current) {
          context.value.status = 'CLOSED'
          context.value.reason = 'connect-error'
        }
        throw cause
      }
    })()
    current.opening = opening
    const clear = () => {
      current.opening = undefined
    }
    void opening.then(clear, clear)
    return opening
  }

  const close = async () => {
    binding = undefined
    setAccount(null)
    if (context.value.attachment === 'ready') await ipc.invoke('close')
  }

  const resume = () => {
    if (context.value.attachment === 'ready') ipc.send('resume')
  }

  if (socketWorker) {
    socketWorker.addEventListener('error', () => {
      failAttachment('failed', 'worker-error')
      ipc.rejectPending(new Error('浏览器后台连接失败'))
    })
    if ('port' in socketWorker) socketWorker.port.start()
    try {
      ipc.send('attach', attachmentId)
      attachmentTimer = setTimeout(
        () => failAttachment('timeout', 'initialization-timeout'),
        WEBSOCKET_WORKER_CONFIG.IPC_TIMEOUT,
      )
    } catch {
      failAttachment('failed', 'worker-start')
    }
  }

  window.addEventListener('pagehide', event => {
    if (event.persisted) return
    if (context.value.attachment === 'ready') ipc.send('detach')
    if (context.value.accountId) endPageSession(context.value.accountId)
    releaseSession()
  })
  window.addEventListener('pageshow', event => {
    if (event.persisted) resume()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resume()
  })

  return { context, ipc, socketEvent, close, open, recordPageStep }
}
