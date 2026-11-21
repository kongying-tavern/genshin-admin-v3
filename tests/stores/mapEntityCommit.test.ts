import type { EntityRow, MapResource, ScopeState } from '@/stores/mapEntitySync/model'
import { describe, expect, it } from 'vitest'
import { planCommit } from '@/stores/mapEntitySync/commit'

const scope = 'backend:account:role'
const state: ScopeState = { scope, revision: 8, resources: {} }
const row = (id: number, overrides: Partial<EntityRow> = {}): EntityRow => ({
  scope,
  resource: 'marker',
  id,
  revision: 7,
  entity: { id, version: 3, linkageId: 'new' },
  ...overrides,
})
const rows = (...records: EntityRow[]) => {
  const byResource = new Map<MapResource, Map<number, EntityRow>>()
  for (const record of records) {
    const existing = byResource.get(record.resource) ?? new Map()
    existing.set(record.id, record)
    byResource.set(record.resource, existing)
  }
  return byResource
}

describe('地图实体提交', () => {
  it('拒绝低版本和早于关联修改的同版本更新', () => {
    const result = planCommit(
      state,
      {
        revision: 7,
        batches: {
          marker: {
            updates: [
              { id: 1, version: 2 },
              { id: 2, version: 3, linkageId: 'old' },
              { id: 3, version: 4 },
            ],
            state: { checkedAt: 100 },
          },
        },
      },
      rows(row(1), row(2, { revision: 8 }), row(3)),
    )
    expect(result.rows.map(entry => entry.id)).toEqual([3])
    expect(result.conflict).toBe(true)
    expect(result.state.resources.marker?.checkedAt).toBeUndefined()
  })

  it('持久删除阻止迟到详情与旧归档复活实体', () => {
    const deleted = planCommit(
      state,
      {
        batches: { marker: { deletes: [1], confirmedDeletes: true } },
      },
      rows(row(1)),
    )
    expect(deleted.rows).toEqual([
      { scope, resource: 'marker', id: 1, revision: 9, deleted: true, removedOnline: true },
    ])
    for (const archive of [true, false]) {
      const later = planCommit(
        deleted.state,
        {
          revision: 9,
          batches: { marker: { updates: [{ id: 1, version: 10 }], archive } },
        },
        rows(...deleted.rows),
      )
      expect(later.rows).toEqual([])
    }
  })

  it('关联和端点存在冲突时整批回滚', () => {
    const result = planCommit(
      state,
      {
        revision: 7,
        atomic: true,
        batches: {
          marker: { updates: [{ id: 1, version: 3, linkageId: 'other' }] },
          markerLink: { deletes: [2], state: { checkedAt: 100 } },
        },
      },
      rows(row(1, { revision: 8 }), row(2, { resource: 'markerLink', entity: { id: 2 } })),
    )
    expect(result.conflict).toBe(true)
    expect(result.state).toBe(state)
    expect(result.rows).toEqual([])
  })

  it('接受合法完整的空关联表', () => {
    const result = planCommit(
      state,
      {
        revision: 8,
        batches: { markerLink: { deletes: [1], state: { baseline: true, checkedAt: 100 } } },
      },
      rows(row(1, { resource: 'markerLink', entity: { id: 1, version: 0 } })),
    )
    expect(result.rows[0]?.entity).toBeUndefined()
    expect(result.counts.deleted).toBe(1)
    expect(result.state.resources.markerLink?.baseline).toBe(true)
  })

  it('归档成员变化保留已由在线核对确认的新增、修改和移除', () => {
    const result = planCommit(
      state,
      {
        revision: 8,
        batches: {
          item: {
            archive: true,
            deletes: [1, 2],
            updates: [
              { id: 3, version: 5 },
              { id: 4, version: 1 },
            ],
          },
        },
      },
      rows(
        row(1, { resource: 'item' }),
        row(2, { resource: 'item', fromArchive: true }),
        row(3, { resource: 'item', entity: undefined, removedOnline: true }),
      ),
    )
    expect(result.rows.map(entry => [entry.id, entry.entity?.version])).toEqual([
      [4, 1],
      [2, undefined],
    ])
  })

  it('不同来源的待核对组会合并并使之前开始的关联读取失效', () => {
    const one = planCommit(state, { batches: { markerLink: { markRanges: ['a'] } } }, rows())
    const two = planCommit(one.state, { batches: { markerLink: { markRanges: ['b'] } } }, rows())
    expect(two.state.resources.markerLink?.pendingRanges).toEqual(['a', 'b'])
    const late = planCommit(
      two.state,
      {
        revision: one.state.revision,
        atomic: true,
        batches: { markerLink: { updates: [{ id: 1 }], state: { pendingRanges: [] } } },
      },
      rows(),
    )
    expect(late.conflict).toBe(true)
    expect(late.rows).toEqual([])
  })
})
