import type { ItemVo } from '@/api/alova/globals'
import { describe, expect, it, vi } from 'vitest'
import {
  checkDetails,
  decodeLinkGroups,
  readItemArea,
  sameMarkerRenderFields,
} from '@/stores/mapEntitySync/sources'

vi.mock('@/api/alova', () => ({ default: {} }))

describe('地图实体数据源', () => {
  it('物品分页按总数走完同一个地区', async () => {
    const record = Array.from({ length: 502 }, (_, i): ItemVo => ({
      id: i + 1,
      areaId: 1,
    }))
    const fetch = vi.fn(async (_id: number, current: number) => ({
      record: record.slice((current - 1) * 500, current * 500),
      total: record.length,
    }))
    expect(await readItemArea(1, fetch)).toEqual(record)
    expect(fetch.mock.calls).toEqual([
      [1, 1],
      [1, 2],
    ])
  })

  it.each([
    { record: [{ id: 1, areaId: 2 }], total: 2 },
    { record: [{ id: 2, areaId: 3 }], total: 2 },
    { record: [{ id: 2, areaId: 2 }], total: 3 },
    { record: [], total: 2 },
    undefined,
  ])('拒绝重复、错误归属、不稳定总数和不足页 %j', async second => {
    await expect(
      readItemArea(2, async (_id, current) =>
        current === 1 ? { record: [{ id: 1, areaId: 2 }], total: 2 } : second,
      ),
    ).rejects.toThrow()
  })

  it('区别完整空关联组与异常响应', () => {
    expect(decodeLinkGroups({}, ['a'])).toEqual([])
    expect(decodeLinkGroups({ a: [] }, ['a'])).toEqual([])
    expect(() => decodeLinkGroups(undefined)).toThrow()
    expect(() => decodeLinkGroups({ b: [] }, ['a'])).toThrow()
    expect(() => decodeLinkGroups({ a: [{ id: 1, groupId: 'a', fromId: 1 }] })).toThrow()
  })

  it('部分详情只能确认已返回的 ID', () => {
    expect(checkDetails([{ id: 2 }], [1, 2])).toEqual([1])
    expect(() => checkDetails([{ id: 2 }], [1])).toThrow()
  })

  it('归档点位与详情的首项物品不同会影响渲染兼容性', () => {
    const a = { itemList: [{ itemId: 1 }, { itemId: 2 }] }
    expect(sameMarkerRenderFields(a, { ...a, hiddenFlag: 0 })).toBe(true)
    expect(sameMarkerRenderFields(a, { itemList: [...a.itemList].reverse() })).toBe(false)
  })
})
