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
  }),
}))
vi.mock('@/stores/item', () => ({ useItemStore: () => ({ update: updateItems }) }))
vi.mock('@/stores/marker', () => ({ useMarkerStore: () => ({ update: async () => {} }) }))
vi.mock('@/stores/markerLink', () => ({ useMarkerLinkStore: () => ({ update: async () => {} }) }))
vi.mock('@/stores/socket/hooks', () => ({
  useSocket: () => ({ context: ref({ status: 'OPEN' }), ipc: { on: vi.fn() }, open, close }),
  useAppEvent: () => ({ event: { on: vi.fn() } }),
  useMessageList: () => ({}),
}))
vi.mock('@/api/alova', () => ({ default: {} }))

describe('地图实体恢复核对', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
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
})
