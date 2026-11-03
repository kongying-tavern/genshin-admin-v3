import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

/**
 * 单元测试：存档同步 store（`src/stores/archive.ts`）
 *
 * 覆盖 P0 关注的同步可靠性约束：
 * - 连续变更通过 300ms 去抖合并为一次写入
 * - 所有同步任务进入串行队列，前一个完成前不会发起下一个
 * - 本地与远程写入使用同一份快照，避免两次读取不一致
 * - 远程失败时按 2s / 4s 退避重试，最多 3 次，失败后保留脏数据
 * - 槽位 / 时间戳等元数据变化不触发同步
 * - pagehide / visibilitychange(hidden) 时立即兜底同步
 */

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  saveArchive: vi.fn(),
  sleep: vi.fn(),
  sleepDelays: [] as number[],
  loggerError: vi.fn(),
}))

/** 测试用登录态，可按用例切换 */
const session = vi.hoisted(() => ({
  valid: true,
  userId: 1,
}))

vi.mock('@/database', () => ({
  default: {
    userArchive: {
      put: mocks.put,
      get: mocks.get,
    },
  },
}))

vi.mock('@/stores', () => ({
  useUserStore: () => ({
    auth: { userId: session.userId },
    validateToken: () => session.valid,
  }),
}))

vi.mock('@/hooks', () => ({
  useFetchHook: () => ({
    data: { value: {} },
    loading: { value: false },
    refresh: vi.fn(async () => {}),
  }),
}))

vi.mock('@/utils', () => ({
  Logger: class Logger {
    error = mocks.loggerError

    info = vi.fn()

    warn = vi.fn()

    debug = vi.fn()
  },
  messageFrom: (err: unknown) => (err instanceof Error ? err.message : String(err)),
  sleep: mocks.sleep,
}))

/** 被替换的 archive 接口集合 */
const archiveApi = {
  saveArchive: mocks.saveArchive,
  getAllHistoryArchive: vi.fn(async () => ({ data: [] })),
  createSlotAndSaveArchive: vi.fn(async () => {}),
  removeArchive: vi.fn(async () => {}),
}

/** 记录用例内注册的全局事件监听，便于在结束后移除 */
const trackedListeners: { target: EventTarget; type: string; listener: EventListener }[] = []

const trackListeners = (target: EventTarget) => {
  const original = target.addEventListener.bind(target)
  vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
    trackedListeners.push({ target, type, listener: listener as EventListener })
    original(type, listener as EventListener, options)
  })
}

/** 清空挂起的 Vue 微任务，让同步链继续推进 */
const flushMicrotasks = async (times = 12) => {
  for (let index = 0; index < times; index += 1) await Promise.resolve()
}

/** 读取远程写入的存档内容 */
const lastRemoteBody = () => JSON.parse(mocks.saveArchive.mock.calls.at(-1)![0].data)

describe('存档同步 store', () => {
  let useArchiveStore: typeof import('@/stores/archive').useArchiveStore

  beforeEach(async () => {
    vi.useFakeTimers()
    setActivePinia(createPinia())

    session.valid = true
    session.userId = 1

    mocks.put.mockReset().mockResolvedValue(undefined)
    mocks.get.mockReset().mockResolvedValue(undefined)
    mocks.saveArchive.mockReset().mockResolvedValue(undefined)
    mocks.sleepDelays.length = 0
    mocks.sleep.mockReset().mockImplementation(async (ms: number) => {
      mocks.sleepDelays.push(ms)
    })
    mocks.loggerError.mockReset()
    trackedListeners.length = 0
    trackListeners(document)
    trackListeners(window)
    Reflect.set(globalThis, 'Apis', { archive: archiveApi })

    ;({ useArchiveStore } = await import('@/stores/archive'))
  })

  afterEach(() => {
    trackedListeners.forEach(({ target, type, listener }) =>
      target.removeEventListener(type, listener),
    )
    trackedListeners.length = 0
    vi.useRealTimers()
  })

  describe('去抖合并', () => {
    it('300ms 内的连续变更只同步一次，且包含全部变更', async () => {
      const store = useArchiveStore()
      store.currentArchive.slotIndex = 2
      await store.init()
      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(300)

      mocks.put.mockClear()
      mocks.saveArchive.mockClear()

      store.currentArchive.body.Data_KYJG.add(1)
      await nextTick()
      store.currentArchive.body.Data_KYJG.add(2)
      await nextTick()

      await vi.advanceTimersByTimeAsync(299)
      expect(mocks.put).not.toHaveBeenCalled()
      expect(mocks.saveArchive).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      await flushMicrotasks()

      expect(mocks.put).toHaveBeenCalledTimes(1)
      expect(mocks.saveArchive).toHaveBeenCalledTimes(1)
      expect(lastRemoteBody().Data_KYJG.sort()).toEqual([1, 2])
    })

    it('槽位与时间戳变化不触发同步', async () => {
      const store = useArchiveStore()
      await store.init()
      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(300)
      mocks.put.mockClear()
      mocks.saveArchive.mockClear()

      store.currentArchive.slotIndex = 3
      store.currentArchive.timestamp = Date.now()
      await nextTick()
      await vi.advanceTimersByTimeAsync(500)

      expect(mocks.put).not.toHaveBeenCalled()
      expect(mocks.saveArchive).not.toHaveBeenCalled()
    })
  })

  describe('串行队列', () => {
    it('前一次同步完成前不会发起下一次，且按变更顺序写入', async () => {
      const store = useArchiveStore()
      store.currentArchive.slotIndex = 1

      let releaseFirst!: () => void
      mocks.saveArchive.mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            releaseFirst = resolve
          }),
      )

      store.currentArchive.body.Data_KYJG.add(1)
      const first = store.saveArchiveToSlot(1)
      await flushMicrotasks()
      expect(mocks.saveArchive).toHaveBeenCalledTimes(1)

      store.currentArchive.body.Data_KYJG.add(2)
      const second = store.saveArchiveToSlot(1)
      await flushMicrotasks()

      // 第一次写入仍挂起，第二次不得并发发出
      expect(mocks.saveArchive).toHaveBeenCalledTimes(1)

      releaseFirst()
      await first
      await second
      await flushMicrotasks()

      expect(mocks.saveArchive).toHaveBeenCalledTimes(2)
      expect(JSON.parse(mocks.saveArchive.mock.calls[0][0].data).Data_KYJG).toEqual([1])
      expect(JSON.parse(mocks.saveArchive.mock.calls[1][0].data).Data_KYJG).toEqual([1, 2])
    })

    it('本地与远程使用同一份快照', async () => {
      const store = useArchiveStore()
      store.currentArchive.slotIndex = 4
      store.currentArchive.body.Data_KYJG.add(7)
      store.currentArchive.body.Time_KYJG[7] = '2026/10/21 10:00:00'

      await store.saveArchiveToSlot(4)
      await flushMicrotasks()

      expect(mocks.put).toHaveBeenCalledTimes(1)
      expect(mocks.saveArchive).toHaveBeenCalledTimes(1)

      const local = mocks.put.mock.calls[0][0].body
      const remote = JSON.parse(mocks.saveArchive.mock.calls[0][0].data)
      expect(local).toEqual(remote)
      expect(mocks.saveArchive.mock.calls[0][0].pathParams).toEqual({ slot_index: 4 })
    })

    it('显式保存强制写入指定槽位，内容未变化也会写入', async () => {
      const store = useArchiveStore()
      expect(store.currentArchive.slotIndex).toBe(-1)

      await store.saveArchiveToSlot(3)
      await store.saveArchiveToSlot(3)
      await flushMicrotasks()

      expect(mocks.saveArchive).toHaveBeenCalledTimes(2)
      expect(mocks.saveArchive.mock.calls.map(call => call[0].pathParams)).toEqual([
        { slot_index: 3 },
        { slot_index: 3 },
      ])
    })

    it('内容未变化时非强制同步直接跳过', async () => {
      const store = useArchiveStore()

      await store.flush()
      await flushMicrotasks()

      expect(mocks.put).not.toHaveBeenCalled()
      expect(mocks.saveArchive).not.toHaveBeenCalled()
    })
  })

  describe('远程失败重试', () => {
    it('失败后按 2s、4s 退避重试，第三次成功', async () => {
      const store = useArchiveStore()
      store.currentArchive.slotIndex = 1
      store.currentArchive.body.Data_KYJG.add(9)

      mocks.saveArchive
        .mockRejectedValueOnce(new Error('network down'))
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce(undefined)

      await store.saveArchiveToSlot(1)

      expect(mocks.saveArchive).toHaveBeenCalledTimes(3)
      expect(mocks.sleepDelays).toEqual([2000, 4000])
      expect(mocks.loggerError).not.toHaveBeenCalled()
    })

    it('三次均失败时保留脏数据，后续同步仍会重试', async () => {
      const store = useArchiveStore()
      store.currentArchive.slotIndex = 1
      store.currentArchive.body.Data_KYJG.add(11)

      mocks.saveArchive.mockRejectedValue(new Error('network down'))

      await store.saveArchiveToSlot(1)

      expect(mocks.saveArchive).toHaveBeenCalledTimes(3)
      expect(mocks.sleepDelays).toEqual([2000, 4000])
      expect(mocks.loggerError).toHaveBeenCalledTimes(1)
      // 本地仍然落盘，远程失败不影响本地存档
      expect(mocks.put).toHaveBeenCalledTimes(1)

      // 未更新已同步快照，下一次同步会再次尝试远程写入
      mocks.saveArchive.mockReset().mockResolvedValue(undefined)
      await store.flush()
      await flushMicrotasks()
      expect(mocks.saveArchive).toHaveBeenCalledTimes(1)
    })
  })

  describe('页面离开兜底', () => {
    it('pagehide 时立即同步，无需等待去抖窗口', async () => {
      const store = useArchiveStore()
      store.currentArchive.slotIndex = 2
      await store.init()
      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(300)
      mocks.put.mockClear()
      mocks.saveArchive.mockClear()

      store.currentArchive.body.Data_KYJG.add(21)
      await nextTick()

      window.dispatchEvent(new Event('pagehide'))
      await flushMicrotasks()

      expect(mocks.put).toHaveBeenCalledTimes(1)
      expect(lastRemoteBody().Data_KYJG).toEqual([21])
    })

    it('visibilitychange 为 hidden 时立即同步', async () => {
      const store = useArchiveStore()
      store.currentArchive.slotIndex = 2
      await store.init()
      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(300)
      mocks.put.mockClear()
      mocks.saveArchive.mockClear()

      const originalVisibility = Object.getOwnPropertyDescriptor(
        Document.prototype,
        'visibilityState',
      )
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })

      try {
        store.currentArchive.body.Data_KYJG.add(22)
        await nextTick()

        document.dispatchEvent(new Event('visibilitychange'))
        await flushMicrotasks()

        expect(mocks.put).toHaveBeenCalledTimes(1)
        expect(lastRemoteBody().Data_KYJG).toEqual([22])
      } finally {
        if (originalVisibility)
          Object.defineProperty(Document.prototype, 'visibilityState', originalVisibility)
        delete (document as unknown as Record<string, unknown>).visibilityState
      }
    })
  })
})
