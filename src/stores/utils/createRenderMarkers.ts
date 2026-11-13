import type { AreaVo, ItemVo, MarkerVo } from '@/api/alova/globals'
import type { GSMarkerInfo } from '@/packages/map'
import type { AreaTileConfig } from '@/stores'
import { useAreaStore, useItemStore, useTileStore } from '@/stores'
import { pickMainItem } from '@/utils'

export interface NormalizeMarkerOptions {
  tileConfigs?: Record<string, AreaTileConfig>
  itemIdMap?: Map<number, ItemVo>
  areaIdMap?: Map<number, AreaVo>
  isTemporary?: boolean
  reset?: boolean
  /**
   * 渲染结果缓存（以点位原始对象为 key）
   *
   * 点位对象自身未变化时可直接复用上一次的渲染结果，
   * 使「新增少量点位」的更新只需要为新增项付出分配成本。
   * 依赖项（底图配置 / 地区 / 物品）变化时请换用新的 WeakMap。
   */
  cache?: WeakMap<MarkerVo, GSMarkerInfo>
}

/** 为点位列表附加渲染配置 */
export const createRenderMarkers = (
  markers: (MarkerVo | GSMarkerInfo)[],
  options: NormalizeMarkerOptions = {},
) => {
  const {
    tileConfigs = useTileStore().mergedTileConfigs ?? {},
    areaIdMap = useAreaStore().areaIdMap,
    itemIdMap = useItemStore().itemIdMap,
    isTemporary = false,
    reset = false,
    cache,
  } = options

  /** 缓存从物品 id 查询到的地区信息和底图配置，减少索引时间复杂度 */
  const cacheMap = new Map<number, { area: AreaVo; tileConfig: AreaTileConfig }>()

  const normalizedMarkers: GSMarkerInfo[] = []

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]

    if (!reset) {
      if ('render' in marker) {
        normalizedMarkers.push(marker)
        continue
      }
      const cached = cache?.get(marker)
      if (cached) {
        normalizedMarkers.push(cached)
        continue
      }
    }

    // TODO 从第一个物品查询地区，后续点位可能存在属于多个地区的情况，需要加以改进
    const [firstItemLink] = marker.itemList ?? []
    if (!firstItemLink?.itemId) continue

    const config =
      cacheMap.get(firstItemLink.itemId)
      ?? (() => {
        const item = itemIdMap.get(firstItemLink.itemId!)
        if (!item) return
        const area = areaIdMap.get(item.areaId!)
        if (!area) return
        const tileConfig = tileConfigs[area.code!]
        if (!tileConfig) return
        const config = { area, tileConfig }
        cacheMap.set(item.id!, config)
        return config
      })()

    if (!config) continue

    // 坐标缺失的点位直接跳过，避免单个脏数据中断整条渲染链路
    if (!marker.position) continue

    const { area, tileConfig } = config
    const [ox, oy] = tileConfig.tile.center
    const [strX, strY] = marker.position.split(',')
    const x = Number(strX)
    const y = Number(strY)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue

    const info: GSMarkerInfo = {
      ...marker,
      render: {
        ...pickMainItem(marker, itemIdMap),
        area,
        tileCode: tileConfig.tile.code,
        position: [x + ox, y + oy],
        isUnderground: marker.extra?.underground?.is_underground ?? false,
        isTemporary,
      },
    }

    cache?.set(marker, info)
    normalizedMarkers.push(info)
  }

  return normalizedMarkers
}
