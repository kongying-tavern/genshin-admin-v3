import type { BridgeCommand } from '@/ai/types'
import type { MarkerVo, TweakVo } from '@/api/alova/globals'
import Apis from '@/api/alova'
import { fail } from '@/ai/errors'
import { objectSchema } from '@/ai/validate'
import { useMarkerControl } from '@/hooks/useMarkerControl'
import { useAccessStore } from '@/stores/access'
import { useAreaStore } from '@/stores/area'
import { useItemStore } from '@/stores/item'
import { useMapStateStore } from '@/stores/mapState'
import { useMarkerStore } from '@/stores/marker'
import { useUserStore } from '@/stores/user'

type MarkerScope = 'all' | 'filtered' | 'visible'
type MarkerSort = 'id' | 'title' | 'updateTime' | 'refreshTime'
type SortOrder = 'asc' | 'desc'

export interface MarkerSlim {
  id: number | undefined
  title: string
  position: string
  positionXY: [number, number] | undefined
  itemIds: number[]
  itemNames: string[]
  typeIds: number[]
  areaCodes: string[]
  hiddenFlag: number
  refreshTime: number
  linkageId: string
  hasPicture: boolean
  hasVideo: boolean
  version: number
  updateTime: string
}

const toPositionXY = (marker: MarkerVo): [number, number] | undefined => {
  const render = (marker as unknown as { render?: { position?: unknown } }).render
  if (Array.isArray(render?.position) && render.position.length >= 2) {
    const [x, y] = render.position.map(value => Number(value))
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y]
  }
  if (!marker.position) return undefined
  const [x, y] = marker.position.split(',').map(value => Number(value))
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return [x, y]
}

const getItemMeta = (marker: MarkerVo) => {
  const itemStore = useItemStore()
  const areaStore = useAreaStore()
  const itemIds: number[] = []
  const itemNames = new Set<string>()
  const typeIds = new Set<number>()
  const areaCodes = new Set<string>()

  for (const link of marker.itemList ?? []) {
    const itemId = link.itemId
    if (itemId === undefined) continue
    itemIds.push(itemId)
    const item = itemStore.itemIdMap.get(itemId)
    if (!item) continue
    if (item.name) itemNames.add(item.name)
    item.typeIdList?.forEach(typeId => {
      if (typeof typeId === 'number') typeIds.add(typeId)
    })
    const area = item.areaId === undefined ? undefined : areaStore.areaIdMap.get(item.areaId)
    if (area?.code) areaCodes.add(area.code)
  }

  return {
    itemIds,
    itemNames: [...itemNames],
    typeIds: [...typeIds],
    areaCodes: [...areaCodes],
  }
}

const matchesItemFilters = (
  marker: MarkerVo,
  filters: { areaCode?: string; itemId?: number; itemTypeId?: number },
) => {
  const { areaCode, itemId, itemTypeId } = filters
  if (areaCode === undefined && itemId === undefined && itemTypeId === undefined) return true
  const itemStore = useItemStore()
  const areaStore = useAreaStore()
  return (marker.itemList ?? []).some(link => {
    if (link.itemId === undefined) return false
    const item = itemStore.itemIdMap.get(link.itemId)
    if (!item) return false
    if (itemId !== undefined && item.id !== itemId) return false
    if (itemTypeId !== undefined && !(item.typeIdList ?? []).includes(itemTypeId)) return false
    if (areaCode !== undefined) {
      const area = item.areaId === undefined ? undefined : areaStore.areaIdMap.get(item.areaId)
      if (area?.code !== areaCode) return false
    }
    return true
  })
}

const getMarkerById = async (id: number): Promise<MarkerVo> => {
  const markerStore = useMarkerStore()
  const local = markerStore.idMap.get(id)
  if (local) return local

  const { data = [] } = await Apis.marker.listMarkerById({
    data: { markerIdList: [id] },
  })
  const remote = data[0]
  if (!remote) fail('E_NOT_FOUND', `点位不存在：${id}`)
  return remote
}

const assertLogin = () => {
  if (!useUserStore().info) {
    fail('E_FORBIDDEN', '请先登录后再操作点位')
  }
}

const assertAccess = (key: Parameters<ReturnType<typeof useAccessStore>['get']>[0]) => {
  if (!useAccessStore().get(key)) {
    fail('E_FORBIDDEN', `当前账号没有权限：${key}`)
  }
}

const compareValues = (left: unknown, right: unknown) => {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left ?? '').localeCompare(String(right ?? ''), 'zh-CN')
}

/** markers.* 命令 */
export const createMarkerCommands = (): BridgeCommand[] => [
  {
    id: 'markers.list',
    title: '点位列表',
    description: '按当前图层/筛选/全部范围分页查询点位，返回精简字段',
    access: 'read',
    params: objectSchema({
      scope: {
        type: 'string',
        enum: ['all', 'filtered', 'visible'],
        default: 'all',
        description:
          'all=全部本地点位，filtered=当前底图+筛选器，visible=当前地图可见（含临时点位）',
      },
      page: { type: 'number', default: 1, minimum: 1, description: '页码' },
      pageSize: { type: 'number', default: 20, minimum: 1, maximum: 200, description: '每页数量' },
      id: { type: 'number', description: '精确点位 id' },
      ids: { type: 'array', items: { type: 'number' }, description: '点位 id 列表' },
      idRange: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: '点位 id 区间 [min, max]',
      },
      titleContains: { type: 'string', description: '标题包含（大小写不敏感）' },
      areaCode: { type: 'string', description: '按物品所属地区 code 过滤' },
      itemId: { type: 'number', description: '按物品 id 过滤' },
      itemTypeId: { type: 'number', description: '按物品类型 id 过滤' },
      hiddenFlag: { type: 'number', minimum: 0, maximum: 3, description: '隐藏标记' },
      linkageId: { type: 'string', description: '关联组 id' },
      hasPicture: { type: 'boolean', description: '是否有点位图片' },
      hasVideo: { type: 'boolean', description: '是否有点位视频' },
      sort: {
        type: 'string',
        enum: ['id', 'title', 'updateTime', 'refreshTime'],
        default: 'id',
        description: '排序字段',
      },
      order: { type: 'string', enum: ['asc', 'desc'], default: 'asc', description: '排序方向' },
    }),
    returns: '{ total, page, pageSize, scope, items }',
    examples: [
      { title: '查询前 5 个点位', params: { pageSize: 5 } },
      { title: '按标题搜索', params: { titleContains: '风神瞳' } },
    ],
    handler: params => {
      const scope = (params.scope ?? 'all') as MarkerScope
      const page = Number(params.page ?? 1)
      const pageSize = Number(params.pageSize ?? 20)
      const markerStore = useMarkerStore()
      const mapStateStore = useMapStateStore()

      const source =
        scope === 'filtered'
          ? (mapStateStore.staticMarkers as MarkerVo[])
          : scope === 'visible'
            ? (mapStateStore.currentMarkers as MarkerVo[])
            : (markerStore.markerList as MarkerVo[])

      const id = params.id as number | undefined
      const ids = params.ids as number[] | undefined
      const idSet = ids ? new Set(ids) : undefined
      const idRange = params.idRange as [number, number] | undefined
      const titleContains = (params.titleContains as string | undefined)?.toLowerCase()
      const hiddenFlag = params.hiddenFlag as number | undefined
      const linkageId = params.linkageId as string | undefined
      const hasPicture = params.hasPicture as boolean | undefined
      const hasVideo = params.hasVideo as boolean | undefined
      const itemFilters = {
        areaCode: params.areaCode as string | undefined,
        itemId: params.itemId as number | undefined,
        itemTypeId: params.itemTypeId as number | undefined,
      }

      const filtered = source.filter(marker => {
        if (marker.id === undefined) return false
        if (id !== undefined && marker.id !== id) return false
        if (idSet && !idSet.has(marker.id)) return false
        if (idRange && (marker.id < idRange[0] || marker.id > idRange[1])) return false
        if (titleContains && !(marker.markerTitle ?? '').toLowerCase().includes(titleContains)) {
          return false
        }
        if (hiddenFlag !== undefined && marker.hiddenFlag !== hiddenFlag) return false
        if (linkageId !== undefined && marker.linkageId !== linkageId) return false
        if (hasPicture !== undefined && Boolean(marker.picture) !== hasPicture) return false
        if (hasVideo !== undefined && Boolean(marker.videoPath) !== hasVideo) return false
        return matchesItemFilters(marker, itemFilters)
      })

      const sort = (params.sort ?? 'id') as MarkerSort
      const order = (params.order ?? 'asc') as SortOrder
      const sorted = [...filtered].sort((left, right) => {
        const leftValue =
          sort === 'title'
            ? left.markerTitle
            : sort === 'updateTime'
              ? left.updateTime
              : sort === 'refreshTime'
                ? left.refreshTime
                : left.id
        const rightValue =
          sort === 'title'
            ? right.markerTitle
            : sort === 'updateTime'
              ? right.updateTime
              : sort === 'refreshTime'
                ? right.refreshTime
                : right.id
        const compared = compareValues(leftValue, rightValue)
        return order === 'desc' ? -compared : compared
      })

      const start = (page - 1) * pageSize
      const items: MarkerSlim[] = sorted.slice(start, start + pageSize).map(marker => {
        const meta = getItemMeta(marker)
        return {
          id: marker.id,
          title: marker.markerTitle ?? '',
          position: marker.position ?? '',
          positionXY: toPositionXY(marker),
          itemIds: meta.itemIds,
          itemNames: meta.itemNames,
          typeIds: meta.typeIds,
          areaCodes: meta.areaCodes,
          hiddenFlag: marker.hiddenFlag ?? 0,
          refreshTime: marker.refreshTime ?? 0,
          linkageId: marker.linkageId ?? '',
          hasPicture: Boolean(marker.picture),
          hasVideo: Boolean(marker.videoPath),
          version: marker.version ?? 0,
          updateTime: marker.updateTime ?? '',
        }
      })

      return {
        total: sorted.length,
        page,
        pageSize,
        scope,
        items,
      }
    },
  },
  {
    id: 'markers.get',
    title: '读取点位',
    description: '按 id 读取完整点位数据；本地不存在时回源查询',
    access: 'read',
    params: objectSchema({ id: { type: 'number', description: '点位 id' } }, ['id']),
    returns: 'MarkerVo',
    examples: [{ title: '读取点位 123', params: { id: 123 } }],
    handler: async params => getMarkerById(params.id as number),
  },
  {
    id: 'markers.focus',
    title: '聚焦点位',
    description: '将地图移动到点位附近并打开点位弹窗',
    access: 'read',
    params: objectSchema({ id: { type: 'number', description: '点位 id' } }, ['id']),
    returns: '{ id, title, positionXY }',
    examples: [{ title: '打开点位弹窗', params: { id: 123 } }],
    handler: async params => {
      const marker = await getMarkerById(params.id as number)
      const markerControl = useMarkerControl()
      markerControl.focusMarker(marker)
      return {
        id: marker.id,
        title: marker.markerTitle ?? '',
        positionXY: toPositionXY(marker),
      }
    },
  },
  {
    id: 'markers.create',
    title: '创建点位',
    description: '直接调用点位 store 创建点位（绕过表单），失败时抛出可靠业务错误',
    access: 'write',
    tags: ['danger-write'],
    params: objectSchema(
      { data: { type: 'object', additionalProperties: true, description: 'MarkerVo' } },
      ['data'],
    ),
    returns: '{ marker }',
    handler: async params => {
      assertLogin()
      assertAccess('MARKER_CREATE')
      const markerStore = useMarkerStore()
      const marker = await markerStore.createMarker(params.data as MarkerVo)
      return { marker }
    },
  },
  {
    id: 'markers.update',
    title: '更新点位',
    description: '直接调用点位 store 更新点位（绕过表单），需要提供完整 MarkerVo 与 version',
    access: 'write',
    tags: ['danger-write'],
    params: objectSchema(
      { data: { type: 'object', additionalProperties: true, description: 'MarkerVo' } },
      ['data'],
    ),
    returns: '{ marker }',
    handler: async params => {
      assertLogin()
      assertAccess('MARKER_EDIT')
      const markerStore = useMarkerStore()
      const marker = await markerStore.updateMarker(params.data as MarkerVo)
      return { marker }
    },
  },
  {
    id: 'markers.delete',
    title: '删除点位',
    description: '直接调用点位 store 删除点位，不经过界面确认框',
    access: 'write',
    tags: ['danger'],
    params: objectSchema({ id: { type: 'number', description: '点位 id' } }, ['id']),
    returns: '{ id, deleted }',
    handler: async params => {
      assertLogin()
      assertAccess('MARKER_DELETE')
      const id = params.id as number
      const markerStore = useMarkerStore()
      await markerStore.deleteMarker(id)
      return { id, deleted: true }
    },
  },
  {
    id: 'markers.tweak',
    title: '批量修改点位',
    description: '直接调用点位 store 的批量编辑接口（TweakVo[]）',
    access: 'write',
    tags: ['danger-write'],
    params: objectSchema(
      {
        tweaks: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
          description: 'TweakVo 列表',
        },
      },
      ['tweaks'],
    ),
    returns: '{ count }',
    handler: async params => {
      assertLogin()
      assertAccess('MARKER_BATCH_EDIT')
      const markerStore = useMarkerStore()
      const updated = await markerStore.tweakMarkers(params.tweaks as TweakVo[])
      return { count: Array.isArray(updated) ? updated.length : 0 }
    },
  },
]
