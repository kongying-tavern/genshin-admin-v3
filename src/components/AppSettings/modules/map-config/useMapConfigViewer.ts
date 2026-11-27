import type {
  MapConfigArea,
  MapConfigFragment,
  MapConfigOverlay,
  MapConfigViewerModel,
} from './model'
import type { OverlaySegmentDetails } from '@/stores/systemConfigLayers'
import { useAccessStore } from '@/stores/access'
import { useAreaStore } from '@/stores/area'
import { useDadianStore } from '@/stores/dadian'
import { useMarkerExtraStore } from '@/stores/markerExtra'
import { useOverlayStore } from '@/stores/overlay'
import { useTileStore } from '@/stores/tile'
import { getMapConfigResources } from './model'

const extraLabels: Record<string, string> = {
  underground: '地下层级',
  '1_6_island': '1.6 海岛阶段',
  '2_8_island': '2.8 海岛阶段',
}

const overlayNode = (
  id: string,
  { name, bounds }: OverlaySegmentDetails,
  { role, multiple }: Pick<MapConfigOverlay, 'role' | 'multiple'>,
  children: MapConfigOverlay[] = [],
): MapConfigOverlay => ({
  id,
  label: name,
  role,
  multiple,
  markerBounds: bounds.pointBounds,
  mapBounds: bounds.mapBounds,
  boundsMessage: bounds.reason,
  boundsSources: bounds.sourcePaths,
  children,
})

const getPluginFragments = (
  config: DTO.DadianJSON,
  code: string,
  hasBeta: boolean,
): MapConfigFragment[] => {
  const sections = hasBeta ? (['plugins', 'pluginsBeta'] as const) : (['plugins'] as const)
  return sections.flatMap(section => {
    const value = config[section]?.[code]
    if (!value) return []
    return [
      {
        label: section === 'plugins' ? '正式地区插件' : 'Beta 地区插件',
        path: `${section}[${JSON.stringify(code)}]`,
        value,
      },
    ]
  })
}

export const useMapConfigViewer = () => {
  const accessStore = useAccessStore()
  const areaStore = useAreaStore()
  const dadianStore = useDadianStore()
  const markerExtraStore = useMarkerExtraStore()
  const overlayStore = useOverlayStore()
  const tileStore = useTileStore()

  const resources = computed(() => getMapConfigResources(dadianStore.raw))
  const areas = computed(() => {
    const result: MapConfigArea[] = []
    for (const { code, name } of areaStore.areaList) {
      if (!code) continue
      const resolved = tileStore.resolvedTileConfigs.get(code)
      if (!resolved) continue

      const { config, mapTarget, bounds, sources, fragments } = resolved
      const { tile, initViewState } = config
      const overlays = (overlayStore.groupsByArea.get(code) ?? []).map(group =>
        overlayNode(
          group.id,
          group,
          group,
          group.items.map(item => {
            const id = `${group.id}.${item.id}`
            return overlayNode(
              id,
              item,
              group,
              item.chunks.map(chunk => overlayNode(`${id}.${chunk.id}`, chunk, group)),
            )
          }),
        ),
      )
      result.push({
        code,
        name: name || code,
        fields: [
          { label: '底图名称', value: tile.name, sources: sources.name },
          { label: '底图代码', value: tile.code, sources: sources.code },
          { label: '尺寸（像素）', value: tile.size, sources: sources.size },
          { label: '格式', value: tile.extension, sources: sources.extension },
          { label: '瓦片偏移', value: tile.tilesOffset, sources: sources.tilesOffset },
          {
            label: '底图边界（地图坐标）',
            value: bounds ?? undefined,
            sources: [...new Set([...sources.tilesOffset, ...sources.size])],
          },
          { label: '点位原点（地图坐标）', value: tile.center, sources: sources.center },
          {
            label: '初始视口中心（点位坐标）',
            value: initViewState.target,
            sources: sources['settings.center'],
          },
          {
            label: '初始视口中心（地图坐标）',
            value: mapTarget,
            sources: [...new Set([...sources['settings.center'], ...sources.center])],
          },
          { label: '初始缩放', value: initViewState.zoom, sources: sources['settings.zoom'] },
        ],
        origin: tile.center,
        viewport: mapTarget,
        bounds: bounds ?? undefined,
        overlayEnabled: overlayStore.enabledAreas.has(code),
        overlays,
        plugins: (markerExtraStore.enabledExtrasByArea.get(code) ?? []).map(
          ({ key, config, sourcePaths }) => ({
            label: extraLabels[key] ?? key,
            path: sourcePaths.find(path => path.includes('.extraConfig')) ?? sourcePaths[0],
            sources: sourcePaths,
            value: config,
          }),
        ),
        fragments: [
          ...fragments.map(({ path, value, kind, beta }) => ({
            label: `${beta ? 'Beta' : '正式'}${kind === 'area' ? '地区底图' : '引用模板'}`,
            path,
            value,
          })),
          ...getPluginFragments(dadianStore.raw, code, accessStore.hasBeta),
        ],
      })
    }
    return result
  })

  return computed<MapConfigViewerModel>(() => ({
    ...dadianStore.meta,
    loading: dadianStore.loading,
    areasLoading: areaStore.updateLoading,
    hasBeta: accessStore.hasBeta,
    areas: areas.value,
    resources: resources.value,
  }))
}
