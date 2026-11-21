import type { BridgeCommand } from '@/ai/types'
import { objectSchema } from '@/ai/validate'
import { useAreaStore } from '@/stores/area'
import { useIconStore } from '@/stores/icon'
import { useItemStore } from '@/stores/item'
import { useItemTypeStore } from '@/stores/itemType'
import { useMarkerLinkStore } from '@/stores/markerLink'
import { toValue } from 'vue'

const PAGE_DEFAULT = 20
const PAGE_MAX = 200

const paginate = <T>(
  list: T[],
  page: number,
  pageSize: number,
): { total: number; page: number; pageSize: number; items: T[] } => {
  const start = (page - 1) * pageSize
  return {
    total: list.length,
    page,
    pageSize,
    items: list.slice(start, start + pageSize),
  }
}

/** resources.* 命令 */
export const createResourceCommands = (): BridgeCommand[] => [
  {
    id: 'resources.areas',
    title: '地区列表',
    description: '读取当前账号可见的地区列表或地区树',
    access: 'read',
    params: objectSchema({
      tree: { type: 'boolean', default: false, description: '是否返回父子树结构' },
    }),
    returns: '{ total, items }',
    examples: [{ title: '读取地区树', params: { tree: true } }],
    handler: params => {
      const areaStore = useAreaStore()
      const items = params.tree
        ? (toValue(areaStore.areaTree) as unknown[])
        : (toValue(areaStore.areaList) as unknown[])
      return { total: items.length, items }
    },
  },
  {
    id: 'resources.items',
    title: '物品列表',
    description: '分页查询物品，可按地区、类型、关键字或 id 列表过滤',
    access: 'read',
    params: objectSchema({
      page: { type: 'number', default: 1, minimum: 1 },
      pageSize: { type: 'number', default: PAGE_DEFAULT, minimum: 1, maximum: PAGE_MAX },
      ids: { type: 'array', items: { type: 'number' }, description: '物品 id 列表' },
      areaId: { type: 'number', description: '地区 id' },
      typeId: { type: 'number', description: '类型 id' },
      keyword: { type: 'string', description: '物品名称包含' },
    }),
    returns: '{ total, page, pageSize, items }',
    examples: [{ title: '按名称查询物品', params: { keyword: '风神瞳' } }],
    handler: params => {
      const itemStore = useItemStore()
      const page = Number(params.page ?? 1)
      const pageSize = Math.min(PAGE_MAX, Number(params.pageSize ?? PAGE_DEFAULT))
      const ids = params.ids as number[] | undefined
      const idSet = ids ? new Set(ids) : undefined
      const areaId = params.areaId as number | undefined
      const typeId = params.typeId as number | undefined
      const keyword = (params.keyword as string | undefined)?.toLowerCase()

      const list = (toValue(itemStore.itemList) as Array<Record<string, unknown>>).filter(item => {
        if (idSet && !idSet.has(item.id as number)) return false
        if (areaId !== undefined && item.areaId !== areaId) return false
        if (typeId !== undefined && !(item.typeIdList as number[] | undefined)?.includes(typeId)) {
          return false
        }
        if (
          keyword
          && !String(item.name ?? '')
            .toLowerCase()
            .includes(keyword)
        )
          return false
        return true
      })

      return paginate(list, page, pageSize)
    },
  },
  {
    id: 'resources.itemTypes',
    title: '物品类型列表',
    description: '读取全部物品类型',
    access: 'read',
    params: objectSchema({}),
    returns: '{ total, items }',
    handler: () => {
      const itemTypeStore = useItemTypeStore()
      const items = toValue(itemTypeStore.itemTypeList) as unknown[]
      return { total: items.length, items }
    },
  },
  {
    id: 'resources.icons',
    title: '图标列表',
    description: '分页查询图标，可按标签/描述/URL 关键字过滤',
    access: 'read',
    params: objectSchema({
      page: { type: 'number', default: 1, minimum: 1 },
      pageSize: { type: 'number', default: PAGE_DEFAULT, minimum: 1, maximum: PAGE_MAX },
      keyword: { type: 'string', description: '标签/描述/URL 包含' },
    }),
    returns: '{ total, page, pageSize, items }',
    handler: params => {
      const iconStore = useIconStore()
      const page = Number(params.page ?? 1)
      const pageSize = Math.min(PAGE_MAX, Number(params.pageSize ?? PAGE_DEFAULT))
      const keyword = (params.keyword as string | undefined)?.toLowerCase()
      const list = (toValue(iconStore.iconList) as Array<Record<string, unknown>>).filter(icon => {
        if (!keyword) return true
        return [icon.tag, icon.description, icon.url]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(keyword))
      })
      return paginate(list, page, pageSize)
    },
  },
  {
    id: 'resources.links',
    title: '点位关联列表',
    description: '分页查询点位关联，可按点位 id 或关联组 id 过滤',
    access: 'read',
    params: objectSchema({
      page: { type: 'number', default: 1, minimum: 1 },
      pageSize: { type: 'number', default: PAGE_DEFAULT, minimum: 1, maximum: PAGE_MAX },
      markerId: { type: 'number', description: '点位 id（匹配 from/to）' },
      groupId: { type: 'string', description: '关联组 id' },
    }),
    returns: '{ total, page, pageSize, items }',
    handler: params => {
      const markerLinkStore = useMarkerLinkStore()
      const page = Number(params.page ?? 1)
      const pageSize = Math.min(PAGE_MAX, Number(params.pageSize ?? PAGE_DEFAULT))
      const markerId = params.markerId as number | undefined
      const groupId = params.groupId as string | undefined
      const list = (
        toValue(markerLinkStore.markerLinkList) as Array<Record<string, unknown>>
      ).filter(link => {
        if (groupId !== undefined && link.groupId !== groupId) return false
        if (markerId !== undefined && link.fromId !== markerId && link.toId !== markerId) {
          return false
        }
        return true
      })
      return paginate(list, page, pageSize)
    },
  },
]
