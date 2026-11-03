import type { ItemSearchVo } from '@/api/alova/globals'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import Apis from '@/api/alova'
import { loginAsTestAccount } from '../_support/auth'
import { probeIntegration } from '../_support/backend'
import { cleanupCreatedTestData } from '../_support/cleanup'
import { integrationConfigured } from '../_support/env'
import {
  createTestArea,
  createTestItem,
  createTestItemType,
  readTestItem,
  TEST_ITEM_NAME_PREFIX,
} from '../_support/factories'
import { setupApiEnv } from '../_support/pinia'

/**
 * 集成测试：物品体系
 *
 * 对齐后端实现（`ItemService` / `ItemController`）的业务规则：
 * - `createItem`：只写物品主表与分类关联；不校验 `areaId` 是否存在 / 是否为末端地区，
 *   也不校验 `iconId` 是否存在；`typeIdList` 含不存在的分类时报「类型ID错误」并回滚。
 * - `listItemById`：按 `hiddenFlag` 过滤，返回分类列表（未关联分类时为空数组），按 sortIndex 倒序。
 * - `updateItem`：`editSame=1` 时把所有「已使用提交名称」的物品一并更新；
 *   更新语句不包含 `defaultCount`，该字段无法通过此接口修改。
 * - `deleteItem`：先清理分类关联与点位关联，再删物品；公共物品（item_area_public）不允许删除。
 * - `copyItemToArea`：复制物品及其分类关联到目标地区，源物品不变。
 */

const enabled = await probeIntegration(integrationConfigured)

/** 分页查询物品，统一使用足够大的分页大小 */
const listItems = async (search: ItemSearchVo) => {
  const { data } = await Apis.item.listItemIdByType({
    data: { current: 1, size: 100, ...search },
  })
  return data
}

describe.skipIf(!enabled)('集成：物品体系', () => {
  beforeEach(() => {
    setupApiEnv()
  })

  afterAll(async () => {
    await cleanupCreatedTestData()
  })

  describe('增删改查', () => {
    it('新建的物品可立即查询到，且入参字段正确落库', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_item_area',
        code: 'C:APITEST_ITEM',
        parentId: -1,
      })
      const typeA = await createTestItemType()
      const typeB = await createTestItemType()
      const name = `${TEST_ITEM_NAME_PREFIX}crud`

      const itemId = await createTestItem(areaId, {
        name,
        defaultCount: 3,
        defaultContent: 'apitest-default-content',
        defaultRefreshTime: 3600_000,
        iconStyleType: 1,
        sortIndex: 9,
        specialFlag: 1,
        typeIdList: [typeA, typeB],
      })

      const item = await readTestItem(itemId)
      expect(item).toBeDefined()
      expect(item!.name).toBe(name)
      expect(item!.areaId).toBe(areaId)
      expect(item!.defaultCount).toBe(3)
      expect(item!.defaultContent).toBe('apitest-default-content')
      expect(item!.defaultRefreshTime).toBe(3600_000)
      expect(item!.iconStyleType).toBe(1)
      expect(item!.sortIndex).toBe(9)
      expect(item!.specialFlag).toBe(1)
      expect(item!.hiddenFlag).toBe(0)
      expect([...(item!.typeIdList ?? [])].sort()).toEqual([typeA, typeB].sort())
    })

    it('省略 typeIdList 时物品分类列表为空数组', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_item_notype_area',
        code: 'C:APITEST_ITEM_NOTYPE',
        parentId: -1,
      })

      const itemId = await createTestItem(areaId)

      expect((await readTestItem(itemId))!.typeIdList).toEqual([])
    })

    it('可更新物品名称与主要字段', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_item_update_area',
        code: 'C:APITEST_ITEM_UPDATE',
        parentId: -1,
      })
      const itemId = await createTestItem(areaId)
      const before = await readTestItem(itemId)

      await Apis.item.updateItem({
        pathParams: { editSame: 0 },
        data: [
          {
            id: itemId,
            name: `${before!.name}_updated`,
            defaultContent: 'updated-content',
            iconStyleType: 2,
            sortIndex: 12,
            specialFlag: 0,
            typeIdList: [],
          },
        ],
      })

      const after = await readTestItem(itemId)
      expect(after!.name).toBe(`${before!.name}_updated`)
      expect(after!.defaultContent).toBe('updated-content')
      expect(after!.iconStyleType).toBe(2)
      expect(after!.sortIndex).toBe(12)
    })

    it('修改分类后返回的分类列表同步变化', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_item_type_area',
        code: 'C:APITEST_ITEM_TYPE',
        parentId: -1,
      })
      const oldType = await createTestItemType()
      const newType = await createTestItemType()
      const itemId = await createTestItem(areaId, { typeIdList: [oldType] })
      const before = await readTestItem(itemId)

      await Apis.item.updateItem({
        pathParams: { editSame: 0 },
        data: [{ id: itemId, name: before!.name, typeIdList: [newType] }],
      })

      expect((await readTestItem(itemId))!.typeIdList).toEqual([newType])
    })

    it('更新接口不会修改 defaultCount（后端更新语句未包含该字段）', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_item_count_area',
        code: 'C:APITEST_ITEM_COUNT',
        parentId: -1,
      })
      const itemId = await createTestItem(areaId, { defaultCount: 1 })
      const before = await readTestItem(itemId)

      await Apis.item.updateItem({
        pathParams: { editSame: 0 },
        data: [{ id: itemId, name: before!.name, defaultCount: 99, typeIdList: [] }],
      })

      expect((await readTestItem(itemId))!.defaultCount).toBe(1)
    })

    it('editSame=1 时会一并更新同名的其他物品', async () => {
      await loginAsTestAccount()
      const areaA = await createTestArea({
        name: '__apitest_item_same_a',
        code: 'C:APITEST_ITEM_SAME_A',
        parentId: -1,
      })
      const areaB = await createTestArea({
        name: '__apitest_item_same_b',
        code: 'C:APITEST_ITEM_SAME_B',
        parentId: -1,
      })
      const name = `${TEST_ITEM_NAME_PREFIX}same`
      const itemA = await createTestItem(areaA, { name, defaultContent: 'origin' })
      const itemB = await createTestItem(areaB, { name, defaultContent: 'origin' })

      await Apis.item.updateItem({
        pathParams: { editSame: 1 },
        data: [{ id: itemA, name, defaultContent: 'same-updated', typeIdList: [] }],
      })

      expect((await readTestItem(itemA))!.defaultContent).toBe('same-updated')
      expect((await readTestItem(itemB))!.defaultContent).toBe('same-updated')
    })

    it('删除物品后无法再查询到，重复删除返回 false', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_item_delete_area',
        code: 'C:APITEST_ITEM_DELETE',
        parentId: -1,
      })
      const itemId = await createTestItem(areaId)

      const { data: deleted } = await Apis.item.deleteItem({ pathParams: { itemId } })
      expect(deleted).toBe(true)
      expect(await readTestItem(itemId)).toBeUndefined()

      const { data: deletedAgain } = await Apis.item.deleteItem({ pathParams: { itemId } })
      expect(deletedAgain).toBe(false)
    })
  })

  describe('边界：创建校验', () => {
    it('分类 ID 不存在时创建失败并提示类型错误', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_item_badtype_area',
        code: 'C:APITEST_ITEM_BADTYPE',
        parentId: -1,
      })
      const name = `${TEST_ITEM_NAME_PREFIX}badtype`

      await expect(
        Apis.item.createItem({
          data: { name, areaId, hiddenFlag: 0, typeIdList: [999999] },
        }),
      ).rejects.toThrow('类型ID错误')

      // 失败后事务回滚，物品不应落库
      const page = await listItems({ name })
      expect(page!.total).toBe(0)
    })

    it('创建时不校验地区是否存在', async () => {
      await loginAsTestAccount()
      const ghostAreaId = 999999
      const name = `${TEST_ITEM_NAME_PREFIX}ghostarea`

      const itemId = await createTestItem(ghostAreaId, { name })

      expect((await readTestItem(itemId))!.areaId).toBe(ghostAreaId)
    })
  })

  describe('查询：地区 / 分类 / 名称筛选', () => {
    it('可按地区、分类与名称筛选出物品', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_item_filter_area',
        code: 'C:APITEST_ITEM_FILTER',
        parentId: -1,
      })
      const typeId = await createTestItemType()
      const name = `${TEST_ITEM_NAME_PREFIX}filter`
      const itemId = await createTestItem(areaId, { name, typeIdList: [typeId] })

      const byArea = await listItems({ areaIdList: [areaId] })
      expect(byArea!.record!.map(item => item.id)).toContain(itemId)

      const byType = await listItems({ typeIdList: [typeId] })
      expect(byType!.record!.map(item => item.id)).toContain(itemId)

      const byName = await listItems({ name: 'filter' })
      expect(byName!.record!.map(item => item.id)).toContain(itemId)
      expect(byName!.record!.every(item => item.name!.includes('filter'))).toBe(true)
    })
  })

  describe('复制物品到地区', () => {
    it('复制后生成新物品，分类关联一并复制，源物品不变', async () => {
      await loginAsTestAccount()
      const sourceArea = await createTestArea({
        name: '__apitest_item_copy_src',
        code: 'C:APITEST_ITEM_COPY_SRC',
        parentId: -1,
      })
      const targetArea = await createTestArea({
        name: '__apitest_item_copy_dst',
        code: 'C:APITEST_ITEM_COPY_DST',
        parentId: -1,
      })
      const typeId = await createTestItemType()
      const itemId = await createTestItem(sourceArea, { typeIdList: [typeId] })
      const sourceBefore = await readTestItem(itemId)

      const { data: newIds = [] } = await Apis.item.copyItemToArea({
        pathParams: { areaId: targetArea },
        data: [itemId],
      })
      expect(newIds).toHaveLength(1)
      const copiedId = newIds[0]
      expect(copiedId).not.toBe(itemId)

      const copied = await readTestItem(copiedId)
      expect(copied!.areaId).toBe(targetArea)
      expect(copied!.name).toBe(sourceBefore!.name)
      expect(copied!.typeIdList).toEqual([typeId])

      const sourceAfter = await readTestItem(itemId)
      expect(sourceAfter!.areaId).toBe(sourceArea)
      expect(sourceAfter!.typeIdList).toEqual([typeId])
    })
  })
})
