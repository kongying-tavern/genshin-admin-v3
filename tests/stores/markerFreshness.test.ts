import type { MarkerVo } from '@/api/alova/globals'
import type { CommitInput, EntityRow } from '@/stores/mapEntitySync/model'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { planCommit } from '@/stores/mapEntitySync/commit'
import { verifyMarkerBatch } from '@/stores/mapEntitySync/markerFreshness'

const api = vi.hoisted(() => ({ detail: vi.fn(), history: vi.fn() }))
vi.mock('@/api/alova', () => ({
  default: {
    marker: { listMarkerById: api.detail },
    history: { searchHistory: api.history },
  },
}))

function method<T>(result: Promise<T>) {
  return { send: vi.fn(() => result), abort: vi.fn() }
}

type Sync = Parameters<typeof verifyMarkerBatch>[0]

function setup(...markers: MarkerVo[]) {
  const session: ReturnType<Sync['current']> = { scope: 'account', tail: Promise.resolve() }
  let current = session
  const records = new Map(
    markers.map((entity): [number, EntityRow] => [
      entity.id!,
      { scope: session.scope, id: entity.id!, resource: 'marker', revision: 1, entity },
    ]),
  )
  const projection: Sync['projection'] = {
    state: { scope: session.scope, revision: 1, resources: {} },
    entities: {
      marker: new Map(markers.map(marker => [marker.id!, marker])),
      item: new Map(),
      markerLink: new Map(),
    },
    pending: { marker: new Set(), item: new Set(), markerLink: new Set() },
    revisions: { marker: 0, item: 0, markerLink: 0 },
    deletedMarkerIds: new Set(),
  }
  const sync = {
    current: () => current,
    assertCurrent: (expected: typeof session) => {
      if (expected !== current) throw new Error('地图数据作用域已切换')
    },
    refresh: async () => projection,
    commit: vi.fn(async (_session: typeof session, input: CommitInput) => {
      const result = planCommit(projection.state, input, new Map([['marker', records]]))
      projection.state = result.state
      result.rows.forEach(row => {
        records.set(row.id, row)
        if (row.entity) projection.entities.marker.set(row.id, row.entity as MarkerVo)
        else projection.entities.marker.delete(row.id)
        if (row.deleted) projection.deletedMarkerIds.add(row.id)
      })
      return result
    }),
    projection,
  }
  const controller = new AbortController()
  const onDeleted = vi.fn()
  const verify = (ids: number[]) =>
    verifyMarkerBatch(sync, session, ids, {
      signal: controller.signal,
      canReadHistory: true,
      canSee: flag => flag !== 2,
      onDeleted,
    })
  return {
    sync,
    session,
    verify,
    controller,
    records,
    onDeleted,
    switchAccount: () => {
      current = { ...session, scope: 'other-account' }
    },
  }
}

describe('交互点位核对', () => {
  beforeEach(() => vi.resetAllMocks())

  it('更新详情并清除不可见点位，仅为有删除记录的点位建立墓碑', async () => {
    const { verify, records, onDeleted, sync, session } = setup(
      { id: 1, version: 1, markerTitle: '旧标题' },
      { id: 2, version: 1 },
      { id: 3, version: 1 },
      { id: 4, version: 1 },
    )
    const updated = { id: 1, version: 2, markerTitle: '新标题' }
    api.detail.mockReturnValue(
      method(
        Promise.resolve({
          data: [updated, { id: 4, version: 2, hiddenFlag: 2 }],
        }),
      ),
    )
    api.history.mockReturnValue(
      method(
        Promise.resolve({
          data: {
            record: [
              { tid: 2, type: 4, editType: 3 },
              { tid: 3, type: 4, editType: 2 },
              { tid: 9, type: 4, editType: 3 },
            ],
          },
        }),
      ),
    )

    await expect(verify([1, 2, 3, 4])).resolves.toEqual(new Map([[1, updated]]))
    expect(api.history).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { id: [2, 3], type: 4, editType: '3', current: 1, size: 2 },
      }),
    )
    expect(records.get(2)).toMatchObject({ deleted: true, removedOnline: true })
    for (const id of [3, 4]) {
      expect(records.get(id)?.entity).toBeUndefined()
      expect(records.get(id)?.deleted).toBeUndefined()
    }
    expect(records.has(9)).toBe(false)
    expect(onDeleted).toHaveBeenCalledTimes(1)

    await sync.commit(session, {
      batches: {
        marker: {
          updates: [
            { id: 2, version: 4 },
            { id: 3, version: 4 },
          ],
        },
      },
    })
    expect(sync.projection.entities.marker.has(2)).toBe(false)
    expect(sync.projection.entities.marker.has(3)).toBe(true)
    await expect(verify([2])).resolves.toEqual(new Map())
    expect(api.detail).toHaveBeenCalledTimes(1)
  })

  it('历史记录读取失败时仍移除已不可查的详情，不声称已删除', async () => {
    const { verify, records, onDeleted } = setup({ id: 1, version: 1 })
    api.detail.mockReturnValue(method(Promise.resolve({ data: [] })))
    api.history.mockReturnValue(method(Promise.reject(new Error('历史记录超时'))))

    await expect(verify([1])).resolves.toEqual(new Map())
    expect(records.get(1)).toMatchObject({ removedOnline: true })
    expect(records.get(1)?.deleted).toBeUndefined()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it.each([
    ['缺少数据字段', {}],
    ['返回未请求 ID', { data: [{ id: 9 }] }],
    ['返回重复 ID', { data: [{ id: 1 }, { id: 1 }] }],
  ])('%s时保留本地数据', async (_, response) => {
    const { verify, sync, onDeleted } = setup({ id: 1, version: 1 })
    api.detail.mockReturnValue(method(Promise.resolve(response)))

    await expect(verify([1])).rejects.toThrow()
    expect(sync.commit).not.toHaveBeenCalled()
    expect(api.history).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('网络请求失败时不清除本地数据', async () => {
    const { verify, sync } = setup({ id: 1, version: 1 })
    api.detail.mockReturnValue(method(Promise.reject(new Error('网络错误'))))

    await expect(verify([1])).rejects.toThrow('网络错误')
    expect(sync.commit).not.toHaveBeenCalled()
  })

  it('读取响应超时会结束核对并取消请求', async () => {
    vi.useFakeTimers()
    try {
      const { verify, sync } = setup({ id: 1, version: 1 })
      const request = method(new Promise<never>(() => {}))
      api.detail.mockReturnValue(request)
      const result = expect(verify([1])).rejects.toThrow('点位核对请求超时')
      await vi.advanceTimersByTimeAsync(8_000)
      await result
      expect(request.abort).toHaveBeenCalledTimes(1)
      expect(sync.commit).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('同一点位在核对期间被更新时，重新查询并保留新版本', async () => {
    const { verify, sync, session, onDeleted } = setup({ id: 1, version: 1 })
    const latest = { id: 1, version: 2 }
    const first = Promise.withResolvers<{ data: MarkerVo[] }>()
    api.detail.mockReturnValueOnce(method(first.promise))
    api.detail.mockReturnValueOnce(method(Promise.resolve({ data: [latest] })))
    api.history.mockReturnValue(method(Promise.resolve({ data: { record: [] } })))

    const result = verify([1])
    await vi.waitFor(() => expect(api.detail).toHaveBeenCalledTimes(1))
    await sync.commit(session, { batches: { marker: { updates: [latest] } } })
    first.resolve({ data: [] })

    await expect(result).resolves.toEqual(new Map([[1, latest]]))
    expect(sync.projection.entities.marker.get(1)).toEqual(latest)
    expect(api.detail).toHaveBeenCalledTimes(2)
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it.each(['切换账号', '取消查询'])('%s后忽略迟到的查询结果', async action => {
    const { verify, sync, controller, switchAccount } = setup({ id: 1, version: 1 })
    const first = Promise.withResolvers<{ data: MarkerVo[] }>()
    const request = method(first.promise)
    api.detail.mockReturnValue(request)
    const result = verify([1])
    await vi.waitFor(() => expect(request.send).toHaveBeenCalled())

    if (action === '切换账号') switchAccount()
    else {
      controller.abort()
      expect(request.abort).toHaveBeenCalled()
    }
    first.resolve({ data: [] })

    await expect(result).rejects.toThrow()
    expect(api.history).not.toHaveBeenCalled()
    expect(sync.commit).not.toHaveBeenCalled()
  })
})
