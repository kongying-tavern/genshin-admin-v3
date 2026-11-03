import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import Apis from '@/api/alova'
import { loginAsTestAccount } from '../_support/auth'
import { probeIntegration } from '../_support/backend'
import { cleanupCreatedAreas } from '../_support/cleanup'
import { integrationConfigured } from '../_support/env'
import {
  createTestArea,
  createTestChildArea,
  createTestRootArea,
  TEST_AREA_NAME_PREFIX,
  testAreaName,
} from '../_support/factories'
import { setupApiEnv } from '../_support/pinia'

/**
 * 集成测试：地区体系
 *
 * 对齐后端实现（`AreaService` / `AreaController`）的业务规则：
 * - `createArea`：`parentId` 必填且不能等于自身 id（否则「父节点不能为空」/「指定的父节点无效」）；
 *   `name`、`code` 必填，`content` 为空时归一化为空串；
 *   新地区强制 `isFinal=true`，并把父级置为非末端；不校验父级是否存在，也不校验 code 唯一性。
 * - `updateArea`：`parentId` 同样必填且不能等于自身 id；变更父级时重算原父级末端标志、
 *   把新父级置为非末端；本地区 `isFinal` 按「是否还有子级」重算，入参中的 isFinal 会被覆盖。
 * - `deleteArea`：递归删除整棵子树（连同地区下的物品与点位），并重算父级末端标志。
 * - `getArea`：命中 `hiddenFlag` 过滤，未命中返回业务错误「地区不存在」。
 * - `listArea`：`isTraverse=false` 只取直接子级；`true` 递归取全部后代（不含自身）。
 *
 * 所有临时地区统一使用 `__apitest_` 前缀，并登记 id 在 afterAll 中回收；
 * 孤立地区（parentId 指向不存在的父级）无法被 -1 递归检索，只能按 id 精确删除。
 */

const enabled = await probeIntegration(integrationConfigured)

/** 读取单个地区，失败即抛错（本文件只用于已知存在的地区） */
const getArea = async (areaId: number) => {
  const { data } = await Apis.area.getArea({ pathParams: { areaId } })
  if (!data) throw new Error(`地区 ${areaId} 不存在`)
  return data
}

describe.skipIf(!enabled)('集成：地区体系', () => {
  beforeEach(() => {
    setupApiEnv()
  })

  afterAll(async () => {
    await cleanupCreatedAreas()
  })

  describe('增删改查', () => {
    it('新建的地区可立即查询到，且入参字段正确落库', async () => {
      await loginAsTestAccount()

      const name = testAreaName('crud')
      const code = `C:APITEST_CRUD`
      const areaId = await createTestArea({
        name,
        code,
        parentId: -1,
        content: 'apitest-content',
        sortIndex: 7,
      })

      const created = await getArea(areaId)
      expect(created.name).toBe(name)
      expect(created.code).toBe(code)
      expect(created.parentId).toBe(-1)
      expect(created.content).toBe('apitest-content')
      expect(created.sortIndex).toBe(7)
    })

    it('省略 content 时由后端归一化为空字符串', async () => {
      await loginAsTestAccount()

      const areaId = await createTestRootArea()

      expect((await getArea(areaId)).content).toBe('')
    })

    it('可更新地区名称，且查询结果同步变化', async () => {
      await loginAsTestAccount()

      const areaId = await createTestRootArea()
      const before = await getArea(areaId)

      await Apis.area.updateArea({
        data: {
          id: areaId,
          name: `${before.name}_updated`,
          code: before.code,
          parentId: before.parentId,
        },
      })

      expect((await getArea(areaId)).name).toBe(`${before.name}_updated`)
    })

    it('可按父级列出直接子地区与整棵子树', async () => {
      await loginAsTestAccount()

      const root = await getArea(await createTestRootArea())
      const childA = await createTestChildArea(root)
      const childB = await createTestChildArea(root)
      const grandChild = await createTestChildArea(await getArea(childA))

      const { data: direct = [] } = await Apis.area.listArea({
        data: { parentId: root.id, isTraverse: false },
      })
      expect(direct.map(area => area.id).sort()).toEqual([childA, childB].sort())

      const { data: subtree = [] } = await Apis.area.listArea({
        data: { parentId: root.id, isTraverse: true },
      })
      expect(subtree.map(area => area.id).sort()).toEqual([childA, childB, grandChild].sort())
    })

    it('删除地区后无法再查询到', async () => {
      await loginAsTestAccount()

      const areaId = await createTestRootArea()

      const { data: deleted } = await Apis.area.deleteArea({ pathParams: { areaId } })
      expect(deleted).toBe(true)

      await expect(Apis.area.getArea({ pathParams: { areaId } })).rejects.toThrow('地区不存在')
    })
  })

  describe('边界：父子校验', () => {
    it('新增地区缺少 parentId 被拒绝', async () => {
      await loginAsTestAccount()

      await expect(
        Apis.area.createArea({
          data: { name: testAreaName('noparent'), code: `C:APITEST_NOPARENT` },
        }),
      ).rejects.toThrow('父节点不能为空')
    })

    it('新增地区把自身 id 作为 parentId 被拒绝', async () => {
      await loginAsTestAccount()

      // 新增时 id 正常为空，这里显式传入 id 以触发「父节点不能等于自身」的守卫
      await expect(
        Apis.area.createArea({
          data: { id: -1, name: testAreaName('self'), code: `C:APITEST_SELF`, parentId: -1 },
        }),
      ).rejects.toThrow('指定的父节点无效')
    })

    it('修改地区缺少 parentId 被拒绝', async () => {
      await loginAsTestAccount()

      const area = await getArea(await createTestRootArea())

      await expect(
        Apis.area.updateArea({
          data: { id: area.id, name: area.name, code: area.code },
        }),
      ).rejects.toThrow('父节点不能为空')
    })

    it('修改地区把自身设为父级（自环）被拒绝', async () => {
      await loginAsTestAccount()

      const area = await getArea(await createTestRootArea())

      await expect(
        Apis.area.updateArea({
          data: { id: area.id, name: area.name, code: area.code, parentId: area.id },
        }),
      ).rejects.toThrow('指定的父节点无效')
    })

    it('缺少地区名称时被后端拒绝', async () => {
      await loginAsTestAccount()

      await expect(
        Apis.area.createArea({
          data: { code: `C:APITEST_NONAME`, parentId: -1 },
        }),
      ).rejects.toThrow('地区名称不能为空')
    })

    it('缺少地区代码时被后端拒绝', async () => {
      await loginAsTestAccount()

      await expect(
        Apis.area.createArea({
          data: { name: testAreaName('nocode'), parentId: -1 },
        }),
      ).rejects.toThrow('地区代码不能为空')
    })
  })

  describe('边界：末端标志（isFinal）', () => {
    it('新建地区初始为末端，新增子级后父级变为非末端', async () => {
      await loginAsTestAccount()

      // 新增时显式传 isFinal=false，服务端仍会强制置为 true
      const rootId = await createTestRootArea({ isFinal: false })
      expect((await getArea(rootId)).isFinal).toBe(true)

      await createTestChildArea(await getArea(rootId))
      expect((await getArea(rootId)).isFinal).toBe(false)
    })

    it('删除唯一的子级后，父级恢复为末端地区', async () => {
      await loginAsTestAccount()

      const rootId = await createTestRootArea()
      const childId = await createTestChildArea(await getArea(rootId))
      expect((await getArea(rootId)).isFinal).toBe(false)

      await Apis.area.deleteArea({ pathParams: { areaId: childId } })
      expect((await getArea(rootId)).isFinal).toBe(true)
    })

    it('变更父级时原父级恢复末端、新父级变为非末端', async () => {
      await loginAsTestAccount()

      const oldParentId = await createTestRootArea()
      const newParentId = await createTestRootArea()
      const childId = await createTestChildArea(await getArea(oldParentId))

      // 重挂前：原父级有子级、新父级无子级
      expect((await getArea(oldParentId)).isFinal).toBe(false)
      expect((await getArea(newParentId)).isFinal).toBe(true)

      const child = await getArea(childId)
      await Apis.area.updateArea({
        data: { id: childId, name: child.name, code: child.code, parentId: newParentId },
      })

      expect((await getArea(childId)).parentId).toBe(newParentId)
      expect((await getArea(oldParentId)).isFinal).toBe(true)
      expect((await getArea(newParentId)).isFinal).toBe(false)
    })

    it('修改时传入的 isFinal 会被按子级数量重算覆盖', async () => {
      await loginAsTestAccount()

      const rootId = await createTestRootArea()
      await createTestChildArea(await getArea(rootId))
      const root = await getArea(rootId)

      // 明明还有子级，却试图改成末端地区：服务端重算后仍为非末端
      const { data: updated } = await Apis.area.updateArea({
        data: {
          id: rootId,
          name: root.name,
          code: root.code,
          parentId: root.parentId,
          isFinal: true,
        },
      })
      expect(updated).toBe(true)
      expect((await getArea(rootId)).isFinal).toBe(false)
    })
  })

  describe('边界：悬挂与级联', () => {
    it('允许在末端地区下继续新增子级（新增不校验父级 isFinal）', async () => {
      await loginAsTestAccount()

      const rootId = await createTestRootArea()
      const childId = await createTestChildArea(await getArea(rootId))
      expect((await getArea(childId)).isFinal).toBe(true)

      const grandChildId = await createTestChildArea(await getArea(childId))
      expect((await getArea(grandChildId)).parentId).toBe(childId)
    })

    it('允许创建指向不存在父级的孤立地区，并可按该 parentId 检索到', async () => {
      await loginAsTestAccount()

      const ghostParentId = 999999
      const areaId = await createTestArea({
        name: testAreaName('orphan'),
        code: `C:APITEST_ORPHAN`,
        parentId: ghostParentId,
      })

      expect((await getArea(areaId)).parentId).toBe(ghostParentId)

      const { data: orphans = [] } = await Apis.area.listArea({
        data: { parentId: ghostParentId, isTraverse: true },
      })
      expect(orphans.map(area => area.id)).toContain(areaId)
    })

    it('地区代码不唯一，重复 code 不阻止创建', async () => {
      await loginAsTestAccount()

      const code = `C:APITEST_DUP`
      const firstId = await createTestArea({
        name: `${TEST_AREA_NAME_PREFIX}dup_a`,
        code,
        parentId: -1,
      })
      const secondId = await createTestArea({
        name: `${TEST_AREA_NAME_PREFIX}dup_b`,
        code,
        parentId: -1,
      })

      expect(secondId).not.toBe(firstId)
      expect((await getArea(secondId)).code).toBe(code)
    })

    it('删除父级会递归删除整棵子树，不产生悬挂子级', async () => {
      await loginAsTestAccount()

      const rootId = await createTestRootArea()
      const childId = await createTestChildArea(await getArea(rootId))
      const grandChildId = await createTestChildArea(await getArea(childId))

      await Apis.area.deleteArea({ pathParams: { areaId: rootId } })

      await expect(Apis.area.getArea({ pathParams: { areaId: childId } })).rejects.toThrow(
        '地区不存在',
      )
      await expect(Apis.area.getArea({ pathParams: { areaId: grandChildId } })).rejects.toThrow(
        '地区不存在',
      )
    })
  })

  describe('边界：异常输入', () => {
    it('查询不存在的地区被拒绝', async () => {
      await loginAsTestAccount()

      await expect(Apis.area.getArea({ pathParams: { areaId: 999999 } })).rejects.toThrow(
        '地区不存在',
      )
    })

    it('更新不存在的地区失败', async () => {
      await loginAsTestAccount()

      // 后端先按 id 取实体（未做存在性校验），取不到会直接 NPE → HTTP 500，此处只断言请求失败
      await expect(
        Apis.area.updateArea({
          data: { id: 999999, name: testAreaName('ghost'), code: `C:APITEST_GHOST`, parentId: -1 },
        }),
      ).rejects.toThrow()
    })

    it('删除不存在的地区失败', async () => {
      await loginAsTestAccount()

      // 同更新：后端未命中记录时返回 HTTP 500
      await expect(Apis.area.deleteArea({ pathParams: { areaId: 999999 } })).rejects.toThrow()
    })
  })
})
