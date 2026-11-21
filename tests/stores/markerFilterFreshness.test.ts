import type { GSMarkerInfo } from '@/packages/map'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'
import { useMarkerFilterFreshness } from '@/stores/mapState/hooks/useMarkerFilterFreshness'

vi.mock('@/api/alova', () => ({ default: {} }))

const scopes: ReturnType<typeof effectScope>[] = []
const marker = (id: number, markerTitle = '') => ({ id, markerTitle }) as GSMarkerInfo

function setup(initial: GSMarkerInfo[], enabledByDefault = true) {
  vi.useFakeTimers()
  const scope = effectScope()
  scopes.push(scope)
  const enabled = ref(enabledByDefault)
  const selection = ref('区域 A')
  const online = ref(true)
  const candidates = shallowRef(initial)
  const requests: Array<{
    ids: number[]
    signal: AbortSignal
    result: PromiseWithResolvers<ReadonlyMap<number, unknown>>
  }> = []
  const verify = (ids: number[], signal: AbortSignal) => {
    const result = Promise.withResolvers<ReadonlyMap<number, unknown>>()
    requests.push({ ids, signal, result })
    return result.promise
  }
  const filtered = scope.run(() =>
    useMarkerFilterFreshness({
      enabled: () => enabled.value,
      selection: () => selection.value,
      online: () => online.value,
      candidates: () => candidates.value,
      verify,
    }),
  )!
  const confirm = (index: number) => {
    const { ids, result } = requests[index]
    result.resolve(new Map(ids.map(id => [id, true])))
  }
  const flush = () => vi.advanceTimersByTimeAsync(0)
  const begin = () => vi.advanceTimersByTimeAsync(160)
  return { filtered, enabled, selection, candidates, online, requests, confirm, begin, flush }
}

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.useRealTimers()
})

describe('筛选结果在线核对', () => {
  it('关闭时直接发布本地点位，切换时取消当前分片并按新状态显示', async () => {
    const { filtered, enabled, candidates, online, requests, confirm, begin, flush } = setup(
      [marker(1)],
      false,
    )
    online.value = false
    await begin()
    expect(filtered.markers.value).toEqual([marker(1)])
    expect(filtered.loading.value).toBe(false)
    expect(filtered.offline.value).toBe(false)
    expect(requests).toHaveLength(0)

    online.value = true
    enabled.value = true
    await nextTick()
    expect(filtered.markers.value).toEqual([])
    expect(filtered.loading.value).toBe(true)
    await begin()
    expect(requests[0].ids).toEqual([1])

    enabled.value = false
    candidates.value = [marker(1), marker(2)]
    await nextTick()
    expect(requests[0].signal.aborted).toBe(true)
    confirm(0)
    await flush()
    expect(filtered.markers.value).toEqual([marker(1), marker(2)])
    expect(filtered.loading.value).toBe(false)
    expect(requests).toHaveLength(1)

    enabled.value = true
    await begin()
    expect(requests[1].ids).toEqual([2, 1])
    confirm(1)
    await flush()
    expect(filtered.markers.value).toEqual([marker(1), marker(2)])
  })

  it('按分片发布已确认的点位，并使用同步后重新筛选出的数据', async () => {
    const { filtered, requests, confirm, candidates, begin, flush } = setup(
      Array.from({ length: 101 }, (_, i) => marker(i + 1)),
    )
    expect(filtered.markers.value).toEqual([])
    expect(filtered.loading.value).toBe(true)

    await begin()
    expect(requests.map(({ ids }) => ids.length)).toEqual([100, 1])
    expect(requests[0].ids[0]).toBe(101)
    const updated = marker(98, '已更新')
    candidates.value = candidates.value.flatMap(row => {
      if (row.id === 99) return []
      return row.id === 98 ? [updated] : [row]
    })
    confirm(0)
    await flush()

    expect(filtered.markers.value).toContain(updated)
    expect(filtered.markers.value.map(({ id }) => id)).not.toContain(99)
    expect(filtered.markers.value).toHaveLength(99)
    expect(filtered.loading.value).toBe(true)

    confirm(1)
    await flush()
    expect(filtered.markers.value).toHaveLength(100)
    expect(filtered.loading.value).toBe(false)
    expect(requests).toHaveLength(2)
  })

  it('切换筛选条件会取消上一轮并忽略迟到结果', async () => {
    const { filtered, requests, confirm, selection, begin, flush } = setup([marker(1)])
    await begin()
    selection.value = '区域 B'
    await nextTick()
    expect(requests[0].signal.aborted).toBe(true)

    confirm(0)
    await flush()
    expect(filtered.markers.value).toEqual([])

    await begin()
    confirm(1)
    await flush()
    expect(filtered.markers.value).toEqual([marker(1)])
  })

  it('只重试失败的分片，重新联网时再次核对所有结果', async () => {
    const { filtered, requests, confirm, online, begin, flush } = setup(
      Array.from({ length: 101 }, (_, i) => marker(i + 1)),
    )
    await begin()
    requests[1].result.reject(new Error('网络错误'))
    confirm(0)
    await flush()

    expect(filtered.markers.value).toHaveLength(100)
    expect(filtered.failed.value).toBe(true)
    expect(filtered.loading.value).toBe(false)

    filtered.retry()
    expect(filtered.markers.value).toHaveLength(100)
    await begin()
    expect(requests[2].ids).toEqual([1])
    confirm(2)
    await flush()
    expect(filtered.markers.value).toHaveLength(101)

    online.value = false
    await nextTick()
    expect(filtered.markers.value).toEqual([])
    expect(filtered.offline.value).toBe(true)

    online.value = true
    await nextTick()
    await begin()
    confirm(3)
    confirm(4)
    await flush()
    expect(filtered.markers.value).toHaveLength(101)
    expect(filtered.failed.value).toBe(false)
  })
})
