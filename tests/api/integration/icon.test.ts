import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import Apis from '@/api/alova'
import { loginAsTestAccount } from '../_support/auth'
import { probeIntegration } from '../_support/backend'
import { cleanupCreatedTestData } from '../_support/cleanup'
import { integrationConfigured } from '../_support/env'
import {
  createTestIcon,
  createTestIconType,
  readTestIcon,
  TEST_ICON_TAG_PREFIX,
  uniqueEntityTag,
} from '../_support/factories'
import { setupApiEnv } from '../_support/pinia'

/**
 * 集成测试：图标体系
 *
 * 对齐后端实现（`IconService` / `IconController`）的业务规则：
 * - `createIcon`：`tag` 必填且精确匹配唯一（区分大小写）；分类 ID 不存在时报「类型ID错误」；
 *   已软删除的同名标签仍然占用标签名。
 * - `getIcon`：不存在时 `data` 为 null，而不是业务错误。
 * - `updateIcon`：`tag` 同样必填；修改为其他图标已使用的标签会被拒绝；
 *   `urlVariants` 与现有值做合并而非整体覆盖；更新时必须携带 `typeIdList` 与 `version`，
 *   否则后端分别会空指针与返回 500。
 * - `deleteIcon`：删除图标及其分类关联；不校验物品 / 分类 / 地区对图标的引用。
 * - `listIcon`：支持按标签模糊查询与按分类精确过滤。
 */

const enabled = await probeIntegration(integrationConfigured)

/** 分页查询图标 */
const listIcons = async (search: { tag?: string; typeIdList?: number[] }) => {
  const { data } = await Apis.icon.listIcon({
    data: { current: 1, size: 100, ...search },
  })
  return data
}

describe.skipIf(!enabled)('集成：图标体系', () => {
  beforeEach(() => {
    setupApiEnv()
  })

  afterAll(async () => {
    await cleanupCreatedTestData()
  })

  describe('增删改查', () => {
    it('新建的图标可立即查询到，且分类关联正确落库', async () => {
      await loginAsTestAccount()
      const iconTypeId = await createTestIconType()
      const tag = `${TEST_ICON_TAG_PREFIX}crud_${uniqueEntityTag()}`

      const iconId = await createTestIcon({
        tag,
        url: 'https://example.test/apitest/crud.png',
        description: 'apitest-crud',
        urlVariants: { small: 'https://example.test/apitest/crud-small.png' },
        typeIdList: [iconTypeId],
      })

      const icon = await readTestIcon(iconId)
      expect(icon).not.toBeNull()
      expect(icon!.tag).toBe(tag)
      expect(icon!.url).toBe('https://example.test/apitest/crud.png')
      expect(icon!.description).toBe('apitest-crud')
      expect(icon!.urlVariants).toEqual({ small: 'https://example.test/apitest/crud-small.png' })

      // 分类关联通过列表的分类过滤验证（getIcon 返回的 typeIdList 受后端实现影响）
      const page = await listIcons({ typeIdList: [iconTypeId] })
      expect(page!.record!.map(item => item.id)).toContain(iconId)
    })

    it('可按标签模糊查询到图标', async () => {
      await loginAsTestAccount()
      const tag = `${TEST_ICON_TAG_PREFIX}search_${uniqueEntityTag()}`
      const iconId = await createTestIcon({ tag })

      const page = await listIcons({ tag })
      expect(page!.record!.map(item => item.id)).toContain(iconId)
    })

    it('更新图标标签与描述后可查询到新值，urlVariants 为合并更新', async () => {
      await loginAsTestAccount()
      const iconId = await createTestIcon({
        urlVariants: { small: 'https://example.test/apitest/small.png' },
      })
      const before = await readTestIcon(iconId)

      await Apis.icon.updateIcon({
        data: {
          id: iconId,
          version: before!.version,
          tag: `${before!.tag}_updated`,
          url: 'https://example.test/apitest/updated.png',
          description: 'updated-description',
          urlVariants: { large: 'https://example.test/apitest/large.png' },
          typeIdList: [],
        },
      })

      const after = await readTestIcon(iconId)
      expect(after!.tag).toBe(`${before!.tag}_updated`)
      expect(after!.url).toBe('https://example.test/apitest/updated.png')
      expect(after!.description).toBe('updated-description')
      expect(after!.urlVariants).toEqual({
        small: 'https://example.test/apitest/small.png',
        large: 'https://example.test/apitest/large.png',
      })
    })

    it('删除图标后查询返回 null，重复删除返回 false', async () => {
      await loginAsTestAccount()
      const iconId = await createTestIcon()

      const { data: deleted } = await Apis.icon.deleteIcon({ pathParams: { iconId } })
      expect(deleted).toBe(true)
      expect(await readTestIcon(iconId)).toBeNull()

      const { data: deletedAgain } = await Apis.icon.deleteIcon({ pathParams: { iconId } })
      expect(deletedAgain).toBe(false)
    })
  })

  describe('边界：标签与分类校验', () => {
    it('标签为空时创建被拒绝', async () => {
      await loginAsTestAccount()

      await expect(
        Apis.icon.createIcon({
          data: { tag: '   ', url: 'https://example.test/apitest/blank.png' },
        }),
      ).rejects.toThrow('图标标签不能为空')
    })

    it('标签重复时创建被拒绝', async () => {
      await loginAsTestAccount()
      const tag = `${TEST_ICON_TAG_PREFIX}duplicate_${uniqueEntityTag()}`
      await createTestIcon({ tag })

      await expect(
        Apis.icon.createIcon({
          data: { tag, url: 'https://example.test/apitest/duplicate.png' },
        }),
      ).rejects.toThrow('已存在')
    })

    it('修改为其他图标已使用的标签被拒绝', async () => {
      await loginAsTestAccount()
      const otherTag = `${TEST_ICON_TAG_PREFIX}occupied_${uniqueEntityTag()}`
      await createTestIcon({ tag: otherTag })
      const iconId = await createTestIcon()
      const before = await readTestIcon(iconId)

      await expect(
        Apis.icon.updateIcon({
          data: {
            id: iconId,
            tag: otherTag,
            url: before!.url,
            description: before!.description,
            typeIdList: [],
          },
        }),
      ).rejects.toThrow('已存在')
    })

    it('分类 ID 不存在时创建失败并提示类型错误', async () => {
      await loginAsTestAccount()
      const tag = `${TEST_ICON_TAG_PREFIX}badtype_${uniqueEntityTag()}`

      await expect(
        Apis.icon.createIcon({
          data: { tag, url: 'https://example.test/apitest/badtype.png', typeIdList: [999999] },
        }),
      ).rejects.toThrow('类型ID错误')

      expect((await listIcons({ tag }))!.record!.map(icon => icon.id)).not.toContain(999999)
      expect((await listIcons({ tag }))!.total).toBe(0)
    })
  })
})
