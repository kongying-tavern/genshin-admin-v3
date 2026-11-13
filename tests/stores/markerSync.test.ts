import type { MarkerVo } from '@/api/alova/globals'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMarkerStore } from '@/stores/marker'

/**
 * 单元测试：点位同步流水线（`src/stores/marker.ts`）
 *
 * 覆盖本次改造关注的可靠性约束：
 * - 差异更新按分片拉取，**每片完成即上图**，不需要等全部点位拉完
 * - 单个分片最终失败不会中断整次同步，其他分片的数据照常写入
 * - 失败信息不会被吞掉：写入 `syncWarning` 并保留可观测的进度
 * - 数据变更按分片落库，而不是最后统一提交一次
 * - 全量整包失败时降级为分片同步
 */

/** 与 store 内的分片参数保持一致 */
const SHARD_SIZE = 1000
const SHARD_CONCURRENCY = 4
const SHARD_RETRY_LIMIT = 3

const mocks = vi.hoisted(() => ({
  toArray: vi.fn(),
  primaryKeys: vi.fn(),
  listMarkerById: vi.fn(),
  listMarkerDiffSnapshot: vi.fn(),
  listMarkersByBinary: vi.fn(),
  writeLocalTable: vi.fn(),
}))

vi.mock('@/database', () => ({
  default: {
    marker: {
      toArray: mocks.toArray,
      toCollection: () => ({ primaryKeys: mocks.primaryKeys }),
    },
  },
}))

vi.mock('@/stores/utils/idbWriter', () => ({
  writeLocalTable: mocks.writeLocalTable,
}))

vi.mock('@/api/alova', () => ({
  default: {
    marker: {
      listMarkerById: mocks.listMarkerById,
      createMarker: vi.fn(),
      updateMarker: vi.fn(),
      deleteMarker: vi.fn(),
      tweakMarkers: vi.fn(),
    },
    marker_doc: {
      listMarkerDiffSnapshotByBinary: mocks.listMarkerDiffSnapshot,
      listMarkersByBinary: mocks.listMarkersByBinary,
    },
  },
}))

vi.mock('@/stores', () => ({
  useAccessStore: () => ({ userHiddenFlagMask: 0 }),
  // `info` 为空时定时拉取不会启动，避免用例被自动同步干扰
  useUserStore: () => ({ info: null }),
  useSocketStore: () => ({
    appEvent: { on: vi.fn() },
    notice: vi.fn(),
  }),
}))

// 重试退避在测试里没有意义，去掉后「分片失败重试」的用例可以瞬时完成
vi.mock('@/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return { ...actual, sleep: vi.fn(async () => {}) }
})

const createDeferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

const createMarker = (id: number, version = 1): MarkerVo => ({
  id,
  version,
  position: '0,0',
  itemList: [{ itemId: 1 }],
})

const range = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => start + i)

const toSnapshot = (ids: number[]) => ({
  snapshots: ids.map(id => ({ id, version: 2, linkageId: null })),
})

describe('点位同步流水线', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.toArray.mockReset().mockResolvedValue([])
    mocks.primaryKeys.mockReset().mockResolvedValue([])
    mocks.listMarkerById.mockReset()
    mocks.listMarkerDiffSnapshot.mockReset()
    mocks.listMarkersByBinary.mockReset()
    mocks.writeLocalTable.mockReset().mockResolvedValue(undefined)
  })

  it('差异更新按分片落库，并在全部完成前就把数据交给地图', async () => {
    const store = useMarkerStore()

    // 本地残留了一个服务端已删除的点位
    mocks.toArray.mockResolvedValue([createMarker(99999)])
    const ids = range(1, 2503) // 3 个分片：1000 / 1000 / 503
    mocks.listMarkerDiffSnapshot.mockResolvedValue(toSnapshot(ids))

    /** 第一个分片落库后放行，用于断言「未拉完就已经上图」 */
    const firstShardPersisted = createDeferred()
    const secondShardRelease = createDeferred()

    mocks.writeLocalTable.mockImplementation(async (input: { bulkPutData?: MarkerVo[] }) => {
      if (input.bulkPutData?.length === SHARD_SIZE) firstShardPersisted.resolve()
    })

    mocks.listMarkerById.mockImplementation(
      async ({ data: { markerIdList } }: { data: { markerIdList: number[] } }) => {
        if (markerIdList[0] === SHARD_SIZE + 1) await secondShardRelease.promise
        return { data: markerIdList.map(id => createMarker(id, 2)) }
      },
    )

    const updating = store.update()

    await firstShardPersisted.promise
    // 第一个分片已经进内存
    expect(store.idMap.size).toBeGreaterThanOrEqual(SHARD_SIZE)
    // 此时第 2、3 个分片还没返回，整体仍处于更新中
    expect(store.updateLoading).toBe(true)
    expect(store.syncProgress.phase).toBe('fetch')

    secondShardRelease.resolve()
    await updating

    expect(store.idMap.size).toBe(2503)
    expect(store.syncWarning).toBe('')
    expect(mocks.listMarkerById).toHaveBeenCalledTimes(3)
    // 删除先落地，且只落库一次（不需要再走一遍整体提交）
    expect(mocks.writeLocalTable).toHaveBeenCalledWith(
      expect.objectContaining({ tableName: 'marker', bulkDeleteKeys: [99999] }),
    )
  })

  it('单个分片重试耗尽后不影响其他分片，并通过 syncWarning 反馈', async () => {
    const store = useMarkerStore()

    const ids = range(1, 2503)
    mocks.listMarkerDiffSnapshot.mockResolvedValue(toSnapshot(ids))

    mocks.listMarkerById.mockImplementation(
      async ({ data: { markerIdList } }: { data: { markerIdList: number[] } }) => {
        if (markerIdList[0] === SHARD_SIZE + 1) throw new Error('网关超时')
        return { data: markerIdList.map(id => createMarker(id, 2)) }
      },
    )

    await store.update()

    // 失败分片之外的数据正常写入
    expect(store.idMap.size).toBe(SHARD_SIZE + 503)
    // 失败信息可见
    expect(store.syncWarning).toContain('网关超时')
    expect(store.syncWarning).toContain(`${SHARD_SIZE}`)
    expect(store.syncProgress.failed).toBe(1)
    expect(store.syncProgress.finished).toBe(3)

    // 失败分片按上限重试，其余分片不额外重试
    const failedCalls = mocks.listMarkerById.mock.calls.filter(
      ([{ data }]) => data.markerIdList[0] === SHARD_SIZE + 1,
    )
    expect(failedCalls).toHaveLength(SHARD_RETRY_LIMIT)
    expect(mocks.listMarkerById).toHaveBeenCalledTimes(1 + SHARD_RETRY_LIMIT + 1)
    // 致命错误（整次失败）不应该被设置为错误，否则会掩盖「部分成功」
    expect(store.managerError).toBe('')
  })

  it('全量整包失败时降级为分片同步', async () => {
    const store = useMarkerStore()

    mocks.listMarkersByBinary.mockRejectedValue(new Error('响应体过大'))
    mocks.listMarkerDiffSnapshot.mockResolvedValue(toSnapshot(range(1, 1200)))
    mocks.listMarkerById.mockImplementation(
      async ({ data: { markerIdList } }: { data: { markerIdList: number[] } }) => ({
        data: markerIdList.map(id => createMarker(id, 1)),
      }),
    )

    await store.update({ isFull: true })

    expect(store.idMap.size).toBe(1200)
    expect(store.managerError).toBe('')
    // 整包失败后确实走了分片接口
    expect(mocks.listMarkerById).toHaveBeenCalledTimes(2)
  })

  it('并发上限生效，不会一次性打满所有分片', async () => {
    const store = useMarkerStore()

    const ids = range(1, SHARD_SIZE * 10 + 1)
    mocks.listMarkerDiffSnapshot.mockResolvedValue(toSnapshot(ids))

    let running = 0
    let maxRunning = 0
    mocks.listMarkerById.mockImplementation(
      async ({ data: { markerIdList } }: { data: { markerIdList: number[] } }) => {
        running += 1
        maxRunning = Math.max(maxRunning, running)
        await Promise.resolve()
        running -= 1
        return { data: markerIdList.map(id => createMarker(id, 2)) }
      },
    )

    await store.update()

    expect(mocks.listMarkerById).toHaveBeenCalledTimes(11)
    expect(maxRunning).toBeLessThanOrEqual(SHARD_CONCURRENCY)
    expect(store.idMap.size).toBe(ids.length)
  })
})
