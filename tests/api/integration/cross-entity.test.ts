import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import Apis from '@/api/alova'
import { loginAsTestAccount } from '../_support/auth'
import { probeIntegration } from '../_support/backend'
import { cleanupCreatedTestData } from '../_support/cleanup'
import { integrationConfigured } from '../_support/env'
import {
  createTestArea,
  createTestIcon,
  createTestItem,
  createTestItemType,
  createTestMarker,
  readTestIcon,
  readTestItem,
  readTestMarker,
} from '../_support/factories'
import { setupApiEnv } from '../_support/pinia'

/**
 * 集成测试：跨实体引用与层叠地区
 *
 * 本文件锁定「点位 → 物品 → 地区」这条核心链路的真实后端行为：
 * - 点位没有 areaId，地区归属完全由 `marker_item_link → item.area_id` 推导，
 *   因此一个点位关联多个地区的物品时，会同时出现在这些地区的检索结果里。
 * - 删除物品会同时删除 `marker_item_link`；点位行本身仍在库中，但读接口 SQL 依赖
 *   物品关联的 join，因此该点位对所有查询接口都不可见。
 * - 删除地区会删除「仅关联该地区物品」的点位。
 * - 图标、物品分类等被引用对象在删除时不校验引用，会产生悬空外键。
 *
 * 注意：当前后端 `AreaService.deleteMarkerAndItemInArea` 使用 `areaIdList` 调用
 * `itemMapper.deleteBatchIds`，误把地区 id 当作物品 id，导致地区下的物品不会被删除。
 * 相关断言按现状编写并标注，待后端修复后需要同步调整。
 */

const enabled = await probeIntegration(integrationConfigured)

/** 读取筛选结果 id 列表 */
const searchMarkerIds = async (search: {
  areaIdList?: number[]
  itemIdList?: number[]
  typeIdList?: number[]
}) => {
  const { data = [] } = await Apis.marker.searchMarkerId({ data: search })
  return data
}

describe.skipIf(!enabled)('集成：跨实体引用与层叠地区', () => {
  beforeEach(() => {
    setupApiEnv()
  })

  afterAll(async () => {
    await cleanupCreatedTestData()
  })

  describe('层叠地区', () => {
    it('关联两个地区物品的点位，在两个地区下都能检索到', async () => {
      await loginAsTestAccount()
      const areaA = await createTestArea({
        name: '__apitest_overlap_area_a',
        code: 'C:APITEST_OVERLAP_A',
        parentId: -1,
      })
      const areaB = await createTestArea({
        name: '__apitest_overlap_area_b',
        code: 'C:APITEST_OVERLAP_B',
        parentId: -1,
      })
      const itemA = await createTestItem(areaA)
      const itemB = await createTestItem(areaB)
      const markerId = await createTestMarker({
        itemList: [
          { itemId: itemA, count: 1 },
          { itemId: itemB, count: 1 },
        ],
      })

      expect(await searchMarkerIds({ areaIdList: [areaA] })).toContain(markerId)
      expect(await searchMarkerIds({ areaIdList: [areaB] })).toContain(markerId)

      const bothAreas = await searchMarkerIds({ areaIdList: [areaA, areaB] })
      expect(bothAreas.filter(id => id === markerId)).toHaveLength(1)
    })

    it('删除其中一个地区的物品后，点位仍归属另一个地区', async () => {
      await loginAsTestAccount()
      const areaA = await createTestArea({
        name: '__apitest_overlap_del_area_a',
        code: 'C:APITEST_OVERLAP_DEL_A',
        parentId: -1,
      })
      const areaB = await createTestArea({
        name: '__apitest_overlap_del_area_b',
        code: 'C:APITEST_OVERLAP_DEL_B',
        parentId: -1,
      })
      const itemA = await createTestItem(areaA)
      const itemB = await createTestItem(areaB)
      const markerId = await createTestMarker({
        itemList: [
          { itemId: itemA, count: 1 },
          { itemId: itemB, count: 1 },
        ],
      })

      await Apis.item.deleteItem({ pathParams: { itemId: itemA } })

      expect(await searchMarkerIds({ areaIdList: [areaA] })).not.toContain(markerId)
      expect(await searchMarkerIds({ areaIdList: [areaB] })).toContain(markerId)

      const marker = await readTestMarker(markerId)
      expect(marker!.itemList!.map(link => link.itemId)).toEqual([itemB])
    })
  })

  describe('删除地区', () => {
    it('仅关联该地区物品的点位被删除，跨地区点位保留', async () => {
      await loginAsTestAccount()
      const areaA = await createTestArea({
        name: '__apitest_area_delete_a',
        code: 'C:APITEST_AREA_DEL_A',
        parentId: -1,
      })
      const areaB = await createTestArea({
        name: '__apitest_area_delete_b',
        code: 'C:APITEST_AREA_DEL_B',
        parentId: -1,
      })
      const itemA = await createTestItem(areaA)
      const itemB = await createTestItem(areaB)
      const markerOnlyA = await createTestMarker({ itemList: [{ itemId: itemA, count: 1 }] })
      const markerBoth = await createTestMarker({
        itemList: [
          { itemId: itemA, count: 1 },
          { itemId: itemB, count: 1 },
        ],
      })

      const { data: deleted } = await Apis.area.deleteArea({ pathParams: { areaId: areaA } })
      expect(deleted).toBe(true)

      expect(await readTestMarker(markerOnlyA)).toBeUndefined()

      const survivor = await readTestMarker(markerBoth)
      expect(survivor).toBeDefined()
      expect(survivor!.itemList!.map(link => link.itemId)).toEqual([itemB])

      // 现状：后端 deleteMarkerAndItemInArea 误用地区 id 删除物品，地区下的物品不会被级联删除
      const orphanItem = await readTestItem(itemA)
      expect(orphanItem).toBeDefined()
      expect(orphanItem!.areaId).toBe(areaA)
    })
  })

  describe('删除物品', () => {
    it('删除物品会清理点位关联，点位不再可查询', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_item_delete_marker_area',
        code: 'C:APITEST_ITEM_DEL_MARKER',
        parentId: -1,
      })
      const itemId = await createTestItem(areaId)
      const markerId = await createTestMarker({ itemList: [{ itemId, count: 1 }] })

      await Apis.item.deleteItem({ pathParams: { itemId } })

      expect(await readTestItem(itemId)).toBeUndefined()
      expect(await readTestMarker(markerId)).toBeUndefined()
      expect(await searchMarkerIds({ itemIdList: [itemId] })).not.toContain(markerId)
    })
  })

  describe('引用完整性', () => {
    it('删除被物品引用的图标不会被阻止，物品保留悬空 iconId', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_icon_ref_area',
        code: 'C:APITEST_ICON_REF',
        parentId: -1,
      })
      const iconId = await createTestIcon()
      const itemId = await createTestItem(areaId, { iconId })

      const { data: deleted } = await Apis.icon.deleteIcon({ pathParams: { iconId } })
      expect(deleted).toBe(true)
      expect(await readTestIcon(iconId)).toBeNull()

      const item = await readTestItem(itemId)
      expect(item).toBeDefined()
      expect(item!.iconId).toBe(iconId)
    })

    it('删除被物品引用的物品分类会移除分类关联，物品本身保留', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_type_ref_area',
        code: 'C:APITEST_TYPE_REF',
        parentId: -1,
      })
      const typeId = await createTestItemType()
      const itemId = await createTestItem(areaId, { typeIdList: [typeId] })

      const { data: deleted } = await Apis.item_type.deleteItemType({
        pathParams: { itemTypeId: typeId },
      })
      expect(deleted).toBe(true)

      const item = await readTestItem(itemId)
      expect(item).toBeDefined()
      expect(item!.typeIdList).toEqual([])
    })
  })
})
