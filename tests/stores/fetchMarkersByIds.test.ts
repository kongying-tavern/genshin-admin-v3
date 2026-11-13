import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMarkersByIds } from '@/stores/utils/fetchMarkersByIds'

/**
 * 单元测试：点位批量查询分片（`src/stores/utils/fetchMarkersByIds.ts`）
 *
 * 服务端对 `markerIdList` 有长度限制，一次性提交全部 id 会直接报错，
 * 因此这里要保证：分片不超过上限、并发受控、失败可重试、脏 id 被清洗。
 */

const mocks = vi.hoisted(() => ({
  listMarkerById: vi.fn(),
}))

vi.mock('@/api/alova', () => ({
  default: {
    marker: {
      listMarkerById: mocks.listMarkerById,
    },
  },
}))

const createIds = (count: number, start = 1) => Array.from({ length: count }, (_, i) => start + i)

interface PendingRequest {
  ids: number[]
  resolve: () => void
}

/** 让接口挂起，由用例决定何时放行，同时记录每次请求携带的 id */
const mockPending = () => {
  const requests: PendingRequest[] = []
  mocks.listMarkerById.mockImplementation(
    ({ data }: { data: { markerIdList: number[] } }) =>
      new Promise(resolve => {
        requests.push({
          ids: data.markerIdList,
          resolve: () => resolve({ data: data.markerIdList.map(id => ({ id })) }),
        })
      }),
  )
  return requests
}

describe('fetchMarkersByIds', () => {
  beforeEach(() => {
    mocks.listMarkerById.mockReset()
  })

  it('空列表不发起请求', async () => {
    mockPending()

    await expect(fetchMarkersByIds([])).resolves.toEqual([])
    expect(mocks.listMarkerById).not.toHaveBeenCalled()
  })

  it('超过上限时按 100 分片', async () => {
    const requests = mockPending()
    const promise = fetchMarkersByIds(createIds(250), { concurrency: 1 })

    for (let i = 0; i < 3; i++) {
      await vi.waitFor(() => expect(requests.length).toBeGreaterThan(i))
      requests[i].resolve()
    }
    const result = await promise

    expect(requests.map(request => request.ids.length)).toEqual([100, 100, 50])
    expect(result).toHaveLength(250)
    // 分片之间不应有重复与遗漏
    expect(new Set(requests.flatMap(request => request.ids)).size).toBe(250)
  })

  it('清洗非法 id 并去重', async () => {
    const requests = mockPending()
    const promise = fetchMarkersByIds([1, 1, 2, Number.NaN, -3, 0, 2.5, 4])

    await vi.waitFor(() => expect(requests).toHaveLength(1))
    requests[0].resolve()
    await promise

    expect(requests[0].ids).toEqual([1, 2, 4])
  })

  it('并发数不超过配置值', async () => {
    const requests: PendingRequest[] = []
    let inFlight = 0
    let maxInFlight = 0
    mocks.listMarkerById.mockImplementation(({ data }: { data: { markerIdList: number[] } }) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      return new Promise(resolve => {
        requests.push({
          ids: data.markerIdList,
          resolve: () => {
            inFlight--
            resolve({ data: data.markerIdList.map(id => ({ id })) })
          },
        })
      })
    })

    const promise = fetchMarkersByIds(createIds(500), { concurrency: 2 })

    await vi.waitFor(() => expect(requests.length).toBe(2))
    for (let i = 0; i < 5; i++) {
      await vi.waitFor(() => expect(requests.length).toBeGreaterThan(i))
      requests[i].resolve()
    }
    await promise

    expect(maxInFlight).toBe(2)
    expect(requests).toHaveLength(5)
  })

  it('单批失败后重试成功', async () => {
    mocks.listMarkerById
      .mockRejectedValueOnce(new Error('请求体过大'))
      .mockResolvedValueOnce({ data: [{ id: 1 }] })

    const result = await fetchMarkersByIds([1], { retry: 2 })

    expect(result).toEqual([{ id: 1 }])
    expect(mocks.listMarkerById).toHaveBeenCalledTimes(2)
  })

  it('重试耗尽后抛出可读错误', async () => {
    mocks.listMarkerById.mockRejectedValue(new Error('请求体过大'))

    await expect(fetchMarkersByIds([1, 2, 3], { retry: 1 })).rejects.toThrow(
      /点位批量查询失败（3 个点位，已重试 1 次）/,
    )
    expect(mocks.listMarkerById).toHaveBeenCalledTimes(2)
  })

  it('按已完成点位回报进度', async () => {
    const requests = mockPending()
    const progress: number[] = []
    const promise = fetchMarkersByIds(createIds(150), {
      concurrency: 1,
      onProgress: (loaded, total) => progress.push(loaded / total),
    })

    await vi.waitFor(() => expect(requests).toHaveLength(1))
    requests[0].resolve()
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    requests[1].resolve()
    await promise

    expect(progress).toEqual([100 / 150, 1])
  })
})
