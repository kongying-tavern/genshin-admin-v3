import type { MarkerVo } from '@/api/alova/globals'
import type { MarkerSnapshot } from '@/stores/utils/diffMarkers'
import { describe, expect, it } from 'vitest'
import { diffMarkers } from '@/stores/utils/diffMarkers'

/**
 * 单元测试：点位差异比对（`src/stores/utils/diffMarkers.ts`）
 *
 * 覆盖差异更新的两个关键约束：
 * - 只有「本地缺失」或「版本落后」的点位才值得回源查询，避免一次拉取超量点位
 * - 关联变更不提升 version，快照里的 linkageId 可直接就地修正，无需回源
 */

const createMarker = (id: number, version: number, linkageId?: string) =>
  ({ id, version, linkageId }) as MarkerVo

const createMap = (markers: MarkerVo[]) =>
  new Map<number, MarkerVo>(markers.map(marker => [marker.id!, marker]))

const snapshot = (id: number, version: number, linkageId?: string): MarkerSnapshot => ({
  id,
  version,
  linkageId,
})

describe('diffMarkers', () => {
  it('本地缺失的点位需要回源查询', async () => {
    const map = createMap([createMarker(1, 1)])

    const result = await diffMarkers([snapshot(1, 1), snapshot(2, 1)], map, new Set(map.keys()))

    expect(result.fetchIds).toEqual([2])
    expect(result.patches).toEqual([])
    expect(result.deleteIds).toEqual([])
  })

  it('版本落后的点位需要回源查询', async () => {
    const map = createMap([createMarker(1, 3)])

    const result = await diffMarkers([snapshot(1, 5)], map, new Set(map.keys()))

    expect(result.fetchIds).toEqual([1])
  })

  it('版本与关联都一致时不产生任何变更', async () => {
    const map = createMap([createMarker(1, 3, 'group-a')])

    const result = await diffMarkers([snapshot(1, 3, 'group-a')], map, new Set(map.keys()))

    expect(result.fetchIds).toEqual([])
    expect(result.patches).toEqual([])
    expect(result.deleteIds).toEqual([])
  })

  it('仅 linkageId 变化时就地修正，不回源查询', async () => {
    const map = createMap([createMarker(1, 3, 'group-a'), createMarker(2, 1)])

    const result = await diffMarkers(
      [snapshot(1, 3, 'group-b'), snapshot(2, 1)],
      map,
      new Set(map.keys()),
    )

    expect(result.fetchIds).toEqual([])
    expect(result.patches).toEqual([{ id: 1, linkageId: 'group-b' }])
  })

  it('本地版本高于快照时保留本地数据', async () => {
    const map = createMap([createMarker(1, 9, 'group-a')])

    const result = await diffMarkers([snapshot(1, 3, 'group-b')], map, new Set(map.keys()))

    expect(result.fetchIds).toEqual([])
    expect(result.patches).toEqual([])
    expect(result.deleteIds).toEqual([])
  })

  it('version 为 0 的快照仍然参与比对', async () => {
    const map = createMap([createMarker(1, 0)])

    const result = await diffMarkers([snapshot(1, 0)], map, new Set(map.keys()))

    expect(result.deleteIds).toEqual([])

    const missing = await diffMarkers([snapshot(2, 0)], map, new Set(map.keys()))
    expect(missing.fetchIds).toEqual([2])
  })

  it('快照中缺失的点位会被标记删除', async () => {
    const map = createMap([createMarker(1, 1), createMarker(2, 1), createMarker(3, 1)])

    const result = await diffMarkers([snapshot(1, 1)], map, new Set(map.keys()))

    expect(result.deleteIds.sort()).toEqual([2, 3])
  })

  it('请求期间新增的点位不会被误删', async () => {
    const map = createMap([createMarker(1, 1), createMarker(2, 1)])
    // 快照请求发出时本地只有 1
    const ownedIds = new Set([1])

    const result = await diffMarkers([snapshot(1, 1)], map, ownedIds)

    expect(result.deleteIds).toEqual([])
  })

  it('忽略 id 缺失的脏快照', async () => {
    const map = createMap([createMarker(1, 1)])

    const result = await diffMarkers([{ version: 2 } as MarkerSnapshot], map, new Set(map.keys()))

    expect(result.fetchIds).toEqual([])
    expect(result.deleteIds).toEqual([1])
    expect(result.total).toBe(1)
  })

  it('空快照会清空所有本地点位', async () => {
    const map = createMap([createMarker(1, 1), createMarker(2, 1)])

    const result = await diffMarkers([], map, new Set(map.keys()))

    expect(result.deleteIds.sort()).toEqual([1, 2])
  })
})
