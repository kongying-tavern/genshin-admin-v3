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
  createTestMarker,
  readTestMarker,
  TEST_MARKER_TITLE_PREFIX,
} from '../_support/factories'
import { setupApiEnv } from '../_support/pinia'

/**
 * 集成测试：点位体系
 *
 * 对齐后端实现（`MarkerService` / `MarkerController`）的业务规则：
 * - `createMarker`：点位不直接关联地区，只通过 `itemList → marker_item_link` 关联物品；
 *   `markerCreatorId` 由后端按当前登录用户强制写入；物品 ID 不做存在性校验。
 * - 读接口（`listMarkerById` / `listMarkerPage`）的 SQL 会 join 物品与地区，
 *   没有任何物品关联的点位对读接口不可见，因此涉及读取 / 更新的用例必须先建物品关联。
 * - `updateMarker`：整体替换物品关联（先删后插）；版本号不匹配时提示「该点位已更新，请重新提交」。
 *   后端会把新旧 `extra` 做合并，`extra` 为 null 时会空指针，故创建与更新都需携带 `extra`。
 * - `deleteMarker`：删除点位及其物品关联，不删除物品；删除不存在的点位时
 *   `saveHistory(List.of(null))` 抛空指针，接口返回 500（后端缺陷，按现状锁定）。
 * - `searchMarkerId`：地区 / 物品 / 分类三类条件互斥，同时传入两类会提示「条件冲突」；
 *   按地区检索时直接匹配 `item.areaId`，不会自动展开子地区。
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

/** 读取点位完整信息列表 */
const searchMarkers = async (search: {
  areaIdList?: number[]
  itemIdList?: number[]
  typeIdList?: number[]
}) => {
  const { data = [] } = await Apis.marker.searchMarker({ data: search })
  return data
}

describe.skipIf(!enabled)('集成：点位体系', () => {
  beforeEach(() => {
    setupApiEnv()
  })

  afterAll(async () => {
    await cleanupCreatedTestData()
  })

  describe('增删改查', () => {
    it('新建的点位可立即查询到，且关联物品与字段正确落库', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_marker_area',
        code: 'C:APITEST_MARKER',
        parentId: -1,
      })
      const itemA = await createTestItem(areaId)
      const itemB = await createTestItem(areaId)
      const title = `${TEST_MARKER_TITLE_PREFIX}crud`

      const markerId = await createTestMarker({
        markerTitle: title,
        position: '123.5,456.5',
        content: 'apitest-content',
        picture: 'https://example.test/apitest/marker.png',
        videoPath: 'https://example.test/apitest/marker.mp4',
        refreshTime: 60_000,
        itemList: [
          { itemId: itemA, count: 2 },
          { itemId: itemB, count: 5 },
        ],
      })

      const marker = await readTestMarker(markerId)
      expect(marker).toBeDefined()
      expect(marker!.markerTitle).toBe(title)
      expect(marker!.position).toBe('123.5,456.5')
      expect(marker!.content).toBe('apitest-content')
      expect(marker!.picture).toBe('https://example.test/apitest/marker.png')
      expect(marker!.videoPath).toBe('https://example.test/apitest/marker.mp4')
      expect(marker!.refreshTime).toBe(60_000)
      expect(marker!.hiddenFlag).toBe(0)
      expect(marker!.markerCreatorId).toBeGreaterThan(0)

      const links = [...(marker!.itemList ?? [])]
      const counts = Object.fromEntries(links.map(link => [link.itemId, link.count]))
      expect(Object.keys(counts).map(Number).sort()).toEqual([itemA, itemB].sort())
      expect(counts[itemA]).toBe(2)
      expect(counts[itemB]).toBe(5)
    })

    it('更新点位字段后可查询到新值', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_marker_update_area',
        code: 'C:APITEST_MARKER_UPDATE',
        parentId: -1,
      })
      const itemId = await createTestItem(areaId)
      const markerId = await createTestMarker({ itemList: [{ itemId, count: 1 }] })
      const before = await readTestMarker(markerId)

      await Apis.marker.updateMarker({
        data: {
          id: markerId,
          version: before!.version,
          markerTitle: `${before!.markerTitle}_updated`,
          position: '1.5,2.5',
          content: 'updated-content',
          refreshTime: 120_000,
          extra: {},
          itemList: [],
        },
      })

      const after = await readTestMarker(markerId)
      expect(after!.markerTitle).toBe(`${before!.markerTitle}_updated`)
      expect(after!.position).toBe('1.5,2.5')
      expect(after!.content).toBe('updated-content')
      expect(after!.refreshTime).toBe(120_000)
    })

    it('更新点位会整体替换物品关联', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_marker_relink_area',
        code: 'C:APITEST_MARKER_RELINK',
        parentId: -1,
      })
      const itemA = await createTestItem(areaId)
      const itemB = await createTestItem(areaId)
      const markerId = await createTestMarker({
        itemList: [
          { itemId: itemA, count: 1 },
          { itemId: itemB, count: 1 },
        ],
      })
      const before = await readTestMarker(markerId)

      await Apis.marker.updateMarker({
        data: {
          id: markerId,
          version: before!.version,
          markerTitle: before!.markerTitle,
          position: before!.position,
          content: before!.content,
          refreshTime: before!.refreshTime,
          extra: {},
          itemList: [{ itemId: itemB, count: 9 }],
        },
      })

      const after = await readTestMarker(markerId)
      expect(after!.itemList).toHaveLength(1)
      expect(after!.itemList![0].itemId).toBe(itemB)
      expect(after!.itemList![0].count).toBe(9)
    })

    it('使用过期版本号更新被拒绝', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_marker_version_area',
        code: 'C:APITEST_MARKER_VERSION',
        parentId: -1,
      })
      const itemId = await createTestItem(areaId)
      const markerId = await createTestMarker({ itemList: [{ itemId, count: 1 }] })
      const before = await readTestMarker(markerId)

      await Apis.marker.updateMarker({
        data: {
          id: markerId,
          version: before!.version,
          markerTitle: before!.markerTitle,
          position: before!.position,
          content: 'first-update',
          refreshTime: before!.refreshTime,
          extra: {},
          itemList: [{ itemId, count: 1 }],
        },
      })

      await expect(
        Apis.marker.updateMarker({
          data: {
            id: markerId,
            version: before!.version,
            markerTitle: before!.markerTitle,
            position: before!.position,
            content: 'stale-update',
            refreshTime: before!.refreshTime,
            extra: {},
            itemList: [{ itemId, count: 1 }],
          },
        }),
      ).rejects.toThrow('该点位已更新，请重新提交')
    })

    it('删除点位后无法再查询到，物品不受影响', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_marker_delete_area',
        code: 'C:APITEST_MARKER_DELETE',
        parentId: -1,
      })
      const itemId = await createTestItem(areaId)
      const markerId = await createTestMarker({ itemList: [{ itemId, count: 1 }] })

      const { data: deleted } = await Apis.marker.deleteMarker({ pathParams: { markerId } })
      expect(deleted).toBe(true)
      expect(await readTestMarker(markerId)).toBeUndefined()

      const { data } = await Apis.item.listItemById({ data: [itemId] })
      expect(data).toHaveLength(1)
    })

    it('删除不存在的点位返回 500', async () => {
      await loginAsTestAccount()

      // 现状：deleteMarker 会先构造历史记录，点位不存在时 buildMarkerDto 返回 null，
      // saveHistory 中的 List.of(null) 直接抛空指针，接口返回 500 而非业务提示。
      await expect(Apis.marker.deleteMarker({ pathParams: { markerId: 999999 } })).rejects.toThrow(
        'Internal Server Error',
      )
    })
  })

  describe('查询：按物品 / 地区 / 分类筛选', () => {
    it('可按物品、地区与分类检索到点位', async () => {
      await loginAsTestAccount()
      const areaId = await createTestArea({
        name: '__apitest_marker_filter_area',
        code: 'C:APITEST_MARKER_FILTER',
        parentId: -1,
      })
      const typeId = await createTestItemType()
      const itemId = await createTestItem(areaId, { typeIdList: [typeId] })
      const markerId = await createTestMarker({ itemList: [{ itemId, count: 1 }] })

      expect(await searchMarkerIds({ itemIdList: [itemId] })).toContain(markerId)
      expect(await searchMarkerIds({ areaIdList: [areaId] })).toContain(markerId)
      expect(await searchMarkerIds({ typeIdList: [typeId] })).toContain(markerId)

      const markers = await searchMarkers({ areaIdList: [areaId] })
      const found = markers.find(marker => marker.id === markerId)
      expect(found).toBeDefined()
      expect(found!.itemList!.map(link => link.itemId)).toContain(itemId)
    })

    it('按地区检索不会自动展开子地区', async () => {
      await loginAsTestAccount()
      const rootId = await createTestArea({
        name: '__apitest_marker_root_area',
        code: 'C:APITEST_MARKER_ROOT',
        parentId: -1,
      })
      const childId = await createTestArea({
        name: '__apitest_marker_child_area',
        code: 'C:APITEST_MARKER_CHILD',
        parentId: rootId,
      })
      const itemId = await createTestItem(childId)
      const markerId = await createTestMarker({ itemList: [{ itemId, count: 1 }] })

      expect(await searchMarkerIds({ areaIdList: [childId] })).toContain(markerId)
      expect(await searchMarkerIds({ areaIdList: [rootId] })).not.toContain(markerId)
    })

    it('同时传入两类筛选条件时提示条件冲突', async () => {
      await loginAsTestAccount()

      await expect(
        Apis.marker.searchMarkerId({
          data: { areaIdList: [-1], itemIdList: [999999] },
        }),
      ).rejects.toThrow('条件冲突')
    })
  })
})
