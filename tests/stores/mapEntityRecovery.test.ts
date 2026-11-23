import type { DiagnosticMessage, DiagnosticStep } from '@/database/websocket/types'
import type { DetailReadObserver } from '@/stores/mapEntitySync/model'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { startMapEntitySync } from '@/stores/mapEntitySync/start'
import { RECHECK_INTERVAL } from '@/stores/mapEntitySync/useEntityManager'
import { useSocketStore } from '@/stores/socket'

const user = reactive({
  auth: { userId: 1, accessToken: 'first' },
  info: { id: 1 },
  refreshUserInfo: vi.fn<() => Promise<void>>(),
})
const open = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined)
const close = vi.fn(async () => {})
const updateItems = vi.fn(async (_options: { isFull: boolean }) => {})
const readMarkers = vi.fn<
  (
    _session: object,
    ids: number[],
    observer: DetailReadObserver,
  ) => Promise<{
    markers: { id: number }[]
    users: Record<number, object>
  }>
>()
const recordPageStep =
  vi.fn<(metadata: DiagnosticMessage | undefined, step: DiagnosticStep) => void>()
const emit = vi.fn()
const listeners = new Map<string, (metadata: DiagnosticMessage, id: number) => void>()
const session = { scope: 'test' }

vi.mock('@/stores', () => ({ useArchiveStore: () => ({}), useUserStore: () => user }))
vi.mock('@/stores/user', () => ({ useUserStore: () => user }))
vi.mock('@/stores/mapEntitySync', () => ({
  useMapEntitySync: () => ({
    scope: session.scope,
    online: true,
    current: () => session,
    isCurrent: (active: unknown) => active === session,
    refresh: async () => ({ state: { resources: {} } }),
    invalidate: async () => {},
    enqueue: (_session: object, work: () => Promise<void>) => Promise.resolve().then(work),
    reportError: vi.fn(),
  }),
}))
vi.mock('@/stores/item', () => ({ useItemStore: () => ({ update: updateItems }) }))
vi.mock('@/stores/marker', () => ({
  useMarkerStore: () => ({ update: async () => {}, readMarkers }),
}))
vi.mock('@/stores/markerLink', () => ({ useMarkerLinkStore: () => ({ update: async () => {} }) }))
vi.mock('@/stores/socket/hooks', () => ({
  useSocket: () => ({
    context: ref({ status: 'OPEN' }),
    ipc: {
      onWithMetadata: (
        event: string,
        listener: (metadata: DiagnosticMessage, id: number) => void,
      ) => {
        listeners.set(event, listener)
      },
    },
    open,
    close,
    recordPageStep,
  }),
  useAppEvent: () => ({ event: { on: vi.fn(), emit } }),
  useMessageList: () => ({}),
}))
vi.mock('@/api/alova', () => ({ default: {} }))

describe('地图实体恢复核对', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    listeners.clear()
    setActivePinia(createPinia())
    user.auth = { userId: 1, accessToken: 'first' }
    user.info = { id: 1 }
    user.refreshUserInfo.mockImplementation(async () => {
      user.info = { ...user.info }
    })
    return () => {
      useSocketStore().$dispose()
      vi.useRealTimers()
    }
  })

  it('待机定时核对和断线重连各触发一次物品全量更新', async ({ onTestFinished }) => {
    const socket = useSocketStore()
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    scope.run(startMapEntitySync)
    await vi.advanceTimersByTimeAsync(0)
    expect(updateItems.mock.calls).toEqual([[{ isFull: false }]])
    updateItems.mockClear()

    await vi.advanceTimersByTimeAsync(RECHECK_INTERVAL + 35_000)
    expect(user.refreshUserInfo).toHaveBeenCalledTimes(1)
    expect(updateItems.mock.calls).toEqual([[{ isFull: true }]])
    expect(open).toHaveBeenCalledTimes(1)

    socket.context.status = 'CLOSED'
    await nextTick()
    socket.context.status = 'OPEN'
    await nextTick()
    await vi.advanceTimersByTimeAsync(35_000)
    expect(user.refreshUserInfo).toHaveBeenCalledTimes(2)
    expect(updateItems.mock.calls).toEqual([[{ isFull: true }], [{ isFull: true }]])
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('令牌轮换后重新握手，切换账号时忽略旧握手回执', async () => {
    const socket = useSocketStore()
    await vi.advanceTimersByTimeAsync(0)
    expect(socket.hasCurrentCredentials).toBe(true)

    const handshake = Promise.withResolvers<void>()
    open.mockReturnValueOnce(handshake.promise)
    user.auth.accessToken = 'second'
    expect(socket.hasCurrentCredentials).toBe(false)
    await nextTick()
    expect(open).toHaveBeenCalledTimes(2)

    user.auth.userId = 2
    await nextTick()
    expect(close).toHaveBeenCalledTimes(1)
    handshake.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(socket.hasCurrentCredentials).toBe(false)

    user.info = { id: 2 }
    await vi.advanceTimersByTimeAsync(0)
    expect(open).toHaveBeenLastCalledWith('2')
    expect(socket.hasCurrentCredentials).toBe(true)
  })

  it('沿用点位批量回读并分别记录各条推送的结果', async ({ onTestFinished }) => {
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    scope.run(startMapEntitySync)
    await vi.advanceTimersByTimeAsync(0)

    const metadata = (id: string): DiagnosticMessage => ({
      trace: { id, accountId: '1', kind: 'push', startedAt: 0, event: 'MarkerUpdated' },
      pageId: 'page',
      bindingId: 'current',
    })
    const fetched = metadata('fetched')
    const missing = metadata('missing')
    readMarkers.mockImplementationOnce(async (_session, _ids, observer) => {
      observer.start()
      observer.received([12])
      throw new Error('点位详情尚待核对')
    })
    const update = listeners.get('MarkerUpdated')!
    update(fetched, 11)
    update(missing, 12)
    await vi.advanceTimersByTimeAsync(0)

    expect(readMarkers).toHaveBeenCalledTimes(1)
    expect(readMarkers.mock.calls[0][1]).toEqual([11, 12])
    expect(emit).not.toHaveBeenCalled()
    expect(recordPageStep).toHaveBeenCalledWith(
      fetched,
      expect.objectContaining({
        code: 'lookup-result',
        state: 'success',
      }),
    )
    expect(recordPageStep).toHaveBeenCalledWith(
      fetched,
      expect.objectContaining({
        code: 'push-processing-failed',
        settles: 'processing',
      }),
    )
    expect(recordPageStep).toHaveBeenCalledWith(
      missing,
      expect.objectContaining({
        code: 'lookup-result',
        lookup: 'marker',
        reason: 'missing-data',
        settles: 'processing',
      }),
    )

    const delivered = metadata('delivered')
    readMarkers.mockImplementationOnce(async (_session, [id], observer) => {
      observer.start()
      observer.received()
      return { markers: [{ id }], users: {} }
    })
    update(delivered, 32)
    await vi.advanceTimersByTimeAsync(0)

    expect(emit).toHaveBeenCalledExactlyOnceWith('MarkerUpdated', { id: 32 }, { id: undefined })
    expect(recordPageStep).toHaveBeenCalledWith(
      delivered,
      expect.objectContaining({
        code: 'push-dispatched',
        settles: 'processing',
      }),
    )
  })
})
