import type { BridgeCommand } from '@/ai/types'
import type { GenshinMapViewState } from '@/packages/map'
import { nextTick } from 'vue'
import { fail } from '@/ai/errors'
import { objectSchema } from '@/ai/validate'
import { getMapState } from '@/ai/appSnapshot'
import { EaseoutInterpolator } from '@/packages/map'
import { MapSubject } from '@/shared'
import { useAreaStore } from '@/stores/area'
import { useTileStore } from '@/stores/tile'
import { usePreferenceStore } from '@/stores/userPreference'
import { sleep } from '@/utils/sleep'

type FilterType = 'basic' | 'advanced'

const applyAreaCode = (code: string) => {
  const areaStore = useAreaStore()
  const preferenceStore = usePreferenceStore()
  const area = areaStore.areaCodeMap.get(code)
  if (!area) fail('E_NOT_FOUND', `地区不存在：${code}`)
  if (!area.isFinal) {
    fail('E_INVALID_PARAMS', `地区 ${code} 不是末端地区，无法切换底图`, {
      hint: '请传入 isFinal=true 的子地区 code',
    })
  }
  const parent = area.parentId === undefined ? undefined : areaStore.areaIdMap.get(area.parentId)
  preferenceStore.parentAreaCode = parent?.code ?? ''
  preferenceStore.areaCode = code
  return { area, parent }
}

/** map.* 命令 */
export const createMapCommands = (): BridgeCommand[] => [
  {
    id: 'map.state',
    title: '地图状态',
    description: '读取当前地区、底图、视口、任务、交互、点位计数、筛选与附加图层状态',
    access: 'read',
    params: objectSchema({}),
    returns: 'MapState',
    examples: [{ title: '读取当前地图状态' }],
    handler: () => getMapState(),
  },
  {
    id: 'map.setView',
    title: '设置地图视口',
    description: '设置视口中心（地图坐标）与缩放；focus 点位请使用 markers.focus',
    access: 'read',
    params: objectSchema({
      target: {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
        description: '视口中心 [x, y]，地图坐标',
      },
      zoom: { type: 'number', minimum: -8, maximum: 8, description: '缩放级别' },
      duration: {
        type: 'number',
        default: 300,
        minimum: 0,
        maximum: 5000,
        description: '过渡时长（毫秒）',
      },
    }),
    returns: '{ requested, viewState, markerView }',
    examples: [{ title: '移动到地图中心', params: { target: [0, 0], zoom: 0 } }],
    handler: async params => {
      const patch: Partial<GenshinMapViewState> = {}
      if (params.target !== undefined) {
        const target = params.target as number[]
        if (
          !Array.isArray(target)
          || target.length !== 2
          || target.some(value => !Number.isFinite(Number(value)))
        ) {
          fail('E_INVALID_PARAMS', 'target 必须是两个有限数字')
        }
        patch.target = [Number(target[0]), Number(target[1])] as [number, number]
      }
      if (params.zoom !== undefined) patch.zoom = Number(params.zoom)
      const duration = Math.max(0, Number(params.duration ?? 300))
      patch.transitionDuration = duration
      patch.transitionInterpolator = new EaseoutInterpolator(['target', 'zoom'])

      MapSubject.viewState.next(patch)
      await nextTick()
      if (duration > 0) await sleep(Math.min(duration, 1000))

      const state = getMapState()
      return {
        requested: {
          target: patch.target,
          zoom: patch.zoom,
          duration,
        },
        viewState: state.viewState,
        markerView: state.markerView,
      }
    },
  },
  {
    id: 'map.setArea',
    title: '切换地区',
    description: '切换到指定末端地区并同步父级地区；地图视口会按地区配置重置',
    access: 'write',
    params: objectSchema({ code: { type: 'string', description: '末端地区 code' } }, ['code']),
    returns: '{ areaCode, parentAreaCode, tileCode, area, state }',
    examples: [{ title: '切换到枫丹', params: { code: 'A:FD:FENGDAN' } }],
    handler: params => {
      const { area, parent } = applyAreaCode(params.code as string)
      const preferenceStore = usePreferenceStore()
      const tileStore = useTileStore()
      return {
        areaCode: preferenceStore.areaCode,
        parentAreaCode: preferenceStore.parentAreaCode,
        tileCode: tileStore.currentTileCode ?? '',
        tileName: tileStore.currentTileConfig?.tile.name ?? '',
        area: {
          id: area.id,
          code: area.code,
          name: area.name,
          parentCode: parent?.code,
        },
        state: getMapState(),
      }
    },
  },
  {
    id: 'map.filter.get',
    title: '读取筛选条件',
    description: '读取基础筛选、高级筛选（生效与缓存）以及筛选类型',
    access: 'read',
    params: objectSchema({}),
    returns: 'MapFilterState',
    handler: () => getMapState().filter,
  },
  {
    id: 'map.filter.setBasic',
    title: '设置基础筛选',
    description: '设置地区、物品类型、物品 id 或基础/高级筛选模式',
    access: 'write',
    params: objectSchema({
      areaCode: { type: 'string', description: '末端地区 code' },
      parentAreaCode: { type: 'string', description: '父级地区 code' },
      itemTypeId: { type: 'number', description: '物品类型 id；-1 表示不选' },
      itemIds: {
        type: 'array',
        items: { type: 'number' },
        description: '选中的物品 id 列表',
      },
      filterType: {
        type: 'string',
        enum: ['basic', 'advanced'],
        description: '筛选器模式',
      },
    }),
    returns: 'MapFilterState',
    handler: params => {
      const preferenceStore = usePreferenceStore()
      const areaStore = useAreaStore()
      if (params.areaCode !== undefined) {
        applyAreaCode(params.areaCode as string)
      }
      if (params.parentAreaCode !== undefined) {
        const parentCode = params.parentAreaCode as string
        if (parentCode && !areaStore.areaCodeMap.has(parentCode)) {
          fail('E_NOT_FOUND', `父级地区不存在：${parentCode}`)
        }
        preferenceStore.parentAreaCode = parentCode
      }
      if (params.itemTypeId !== undefined) {
        preferenceStore.itemTypeId = Number(params.itemTypeId)
      }
      if (params.itemIds !== undefined) {
        preferenceStore.itemIds = (params.itemIds as number[]).map(Number)
      }
      if (params.filterType !== undefined) {
        preferenceStore.filterType = params.filterType as FilterType
      }
      return getMapState().filter
    },
  },
]
