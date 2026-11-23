import type { DiagnosticMessage } from '@/database/websocket/types'
import type { RequestMessage } from '@/utils/worker/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { diagnosticStep } from '@/database/websocket/diagnostics'
import { useSocket } from '@/stores/socket/hooks/useSocket'

const { auth, record } = vi.hoisted(() => ({
  auth: { accessToken: 'first-test-token' },
  record: vi.fn(async (..._args: unknown[]) => {}),
}))

vi.mock('@/stores/user', () => ({ useUserStore: () => ({ auth }) }))
vi.mock('@/worker/webSocket/socket.worker?worker&url', () => ({
  default: '/test-socket-worker.js',
}))
vi.mock('@/database/websocket/diagnostics', async importOriginal => ({
  ...(await importOriginal<typeof import('@/database/websocket/diagnostics')>()),
  recordDiagnostic: record,
  interruptStaleDiagnostics: async () => {},
  endDiagnosticSession: async () => {},
  trackDiagnosticSession: () => () => {},
}))

class TestWorker extends EventTarget {
  static instance: TestWorker
  requests: RequestMessage[] = []

  constructor() {
    super()
    TestWorker.instance = this
  }

  postMessage(message: RequestMessage) {
    this.requests.push(message)
  }

  emit(channel: string, args: unknown[], metadata?: DiagnosticMessage) {
    this.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'request', channel, args, metadata, id: crypto.randomUUID() },
      }),
    )
  }

  respond(request: RequestMessage, result?: unknown) {
    this.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'response', id: request.id, result },
      }),
    )
  }

  openRequests() {
    return this.requests.filter(({ channel }) => channel === 'open') as RequestMessage<
      AppSocket.MainEventMap['open']['args']
    >[]
  }
}

describe('通信诊断接入', () => {
  afterEach(() => {
    auth.accessToken = 'first-test-token'
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('等待后台接入，并在同一账号换令牌时隔离旧连接的状态和推送', async () => {
    vi.stubGlobal('SharedWorker', undefined)
    vi.stubGlobal('Worker', TestWorker)
    vi.stubEnv('VITE_WS_BASE', 'http://localhost/socket.io')
    const socket = useSocket()
    const worker = TestWorker.instance
    const handleMarker = vi.fn()
    const unsubscribe = socket.ipc.on('MarkerUpdated', handleMarker)

    const first = socket.open('77')
    expect(socket.open('77')).toBe(first)
    const attached = worker.requests.find(({ channel }) => channel === 'attach')!
    expect(worker.openRequests()).toHaveLength(0)
    worker.emit('init', [
      'page',
      attached.args[0],
      diagnosticStep('attachment-ready', 'worker', 'sent', { to: 'page' }),
    ])
    await Promise.resolve()
    const [firstRequest] = worker.openRequests()
    const [, firstOptions] = firstRequest.args
    expect(firstOptions.query).toEqual({ userId: '77', token: 'first-test-token' })
    worker.emit('connectionState', [
      firstOptions.bindingId,
      { status: 'OPEN', connectionId: 'first' },
    ])
    worker.respond(firstRequest, 'created')
    await first
    expect(socket.context.value.connectionId).toBe('first')

    auth.accessToken = 'second-test-token'
    const second = socket.open('77')
    await Promise.resolve()
    const [, secondRequest] = worker.openRequests()
    const [, secondOptions] = secondRequest.args
    expect(secondOptions.query.token).toBe('second-test-token')
    expect(secondOptions.bindingId).not.toBe(firstOptions.bindingId)
    worker.emit('connectionState', [
      firstOptions.bindingId,
      { status: 'OPEN', connectionId: 'first' },
    ])
    expect(socket.context.value.connectionId).toBeNull()
    const push = (bindingId: string, id: number) => {
      worker.emit('MarkerUpdated', [id], {
        bindingId,
        pageId: 'page',
        trace: {
          id: String(id),
          accountId: '77',
          kind: 'push',
          startedAt: 0,
          event: 'MarkerUpdated',
        },
      })
    }
    push(firstOptions.bindingId, 11)
    worker.emit('connectionState', [
      secondOptions.bindingId,
      { status: 'OPEN', connectionId: 'second' },
    ])
    worker.respond(secondRequest, 'created')
    await second
    push(secondOptions.bindingId, 12)

    expect(handleMarker).toHaveBeenCalledExactlyOnceWith(12)
    expect(
      worker.requests.filter(({ channel }) => channel === 'receipt').map(({ args }) => args),
    ).toEqual([['12', 'page']])
    unsubscribe()
    push(secondOptions.bindingId, 13)
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ id: '13' }),
      expect.arrayContaining([
        expect.objectContaining({
          code: 'interrupted',
          reason: 'handler-unavailable',
          settles: 'processing',
        }),
      ]),
    )
    expect(JSON.stringify(record.mock.calls)).not.toContain('test-token')
  })
})
