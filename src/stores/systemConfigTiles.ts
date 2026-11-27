import type { AreaAdditionalConfig } from '@/configs/areas'
import { defaultsDeep, get, merge } from 'lodash'
import { AREA_ADDITIONAL_CONFIG_MAP } from '@/configs/areas'
import { getTileBounds, toMapCoordinate } from '@/packages/map/src/utils/mapCoordinates'

export interface TileInfo extends Required<
  Pick<DTO.TileConfig, 'code' | 'name' | 'extension' | 'tilesOffset' | 'size' | 'center'>
> {}

export interface AreaTileConfig {
  /** 地区 code，便于在列表中使用 */
  code?: string
  /** 地区关联的 tile 的信息，使用对象是为了方便复用 */
  tile: TileInfo
  /** 导航到该地区时的默认视口状态，中心使用点位坐标 */
  initViewState: {
    target: DTO.Coordinate2D
    zoom: number
  }
}

type TileCoordinateField = 'center' | 'size' | 'tilesOffset' | 'settings.center'
export type TileConfigField = keyof TileInfo | 'settings.center' | 'settings.zoom'

export interface TileConfigFragment {
  path: string
  value: DTO.TileConfig
  kind: 'area' | 'template'
  beta: boolean
}

export interface ResolvedAreaTileConfig {
  config: AreaTileConfig
  mapTarget: DTO.Coordinate2D
  bounds: DTO.OverlayBounds | null
  sources: Record<TileConfigField, string[]>
  fragments: TileConfigFragment[]
}

const DEFAULT_SOURCE = '代码默认值'

const isCoordinate = (value: unknown): value is DTO.Coordinate2D =>
  Array.isArray(value)
  && value.length === 2
  && Number.isFinite(value[0])
  && Number.isFinite(value[1])

const coordinateOrZero = (value: unknown): DTO.Coordinate2D =>
  isCoordinate(value) ? value : [0, 0]

export const resolveSystemConfigTiles = (
  { tiles = {}, tilesBeta = {} }: DTO.DadianJSON,
  hasBeta: boolean,
  additionalConfigs: Readonly<Record<string, AreaAdditionalConfig>> = AREA_ADDITIONAL_CONFIG_MAP,
): Map<string, ResolvedAreaTileConfig> => {
  const inputs = hasBeta ? ([tiles, tilesBeta] as const) : ([tiles] as const)
  const mergedTiles = hasBeta ? merge({}, tiles, tilesBeta) : merge({}, tiles)

  const getFragments = (key: string, kind: TileConfigFragment['kind']) =>
    inputs.flatMap((input, index): TileConfigFragment[] => {
      if (!Object.hasOwn(input, key)) return []
      const beta = index === 1
      return [
        {
          path: `${beta ? 'tilesBeta' : 'tiles'}[${JSON.stringify(key)}]`,
          value: input[key],
          kind,
          beta,
        },
      ]
    })

  const result = new Map<string, ResolvedAreaTileConfig>()
  for (const [areaCode, area] of Object.entries(mergedTiles)) {
    // 继承模板仅作为地区配置的来源，底图索引只保留实际地区。
    if (!/[A-Z]:[A-Z]+(?::\s+)?/.test(areaCode) || !area) continue

    const templateKey = area.extend
    const template =
      templateKey && Object.hasOwn(mergedTiles, templateKey) ? mergedTiles[templateKey] : undefined
    // 只使用直接引用的模板，解析结果互不影响。
    const tileConfig = defaultsDeep({}, area, template) as DTO.TileConfig
    const areaFragments = getFragments(areaCode, 'area')
    const templateFragments = templateKey && template ? getFragments(templateKey, 'template') : []
    const sourcesByPriority = [...areaFragments.toReversed(), ...templateFragments.toReversed()]
    const findSource = (path: string[]) =>
      sourcesByPriority.find(fragment => get(fragment.value, path) !== undefined)

    const scalarSource = (field: TileConfigField) => {
      const source = findSource(field.split('.'))
      return [source ? `${source.path}.${field}` : DEFAULT_SOURCE]
    }
    const coordinateSources = (field: TileCoordinateField, value: unknown) => {
      if (!isCoordinate(value)) return [DEFAULT_SOURCE]
      const path = field.split('.')
      const xSource = findSource([...path, '0'])
      const ySource = findSource([...path, '1'])
      if (xSource && xSource === ySource) return [`${xSource.path}.${field}`]
      return [
        xSource ? `${xSource.path}.${field}[0]` : DEFAULT_SOURCE,
        ySource ? `${ySource.path}.${field}[1]` : DEFAULT_SOURCE,
      ]
    }

    const {
      code = '',
      name = '',
      extension = 'png',
      center,
      settings,
      size,
      tilesOffset,
    } = tileConfig
    const { center: configuredTarget, zoom = 0 } = settings ?? {}
    const builtinTarget = additionalConfigs[areaCode]?.target
    const hasBuiltinTarget = isCoordinate(builtinTarget)
    const config: AreaTileConfig = {
      tile: {
        code,
        name,
        center: coordinateOrZero(center),
        size: coordinateOrZero(size),
        extension,
        tilesOffset: coordinateOrZero(tilesOffset),
      },
      initViewState: {
        target: hasBuiltinTarget ? [...builtinTarget] : coordinateOrZero(configuredTarget),
        zoom,
      },
    }
    result.set(areaCode, {
      config,
      mapTarget: toMapCoordinate(config.initViewState.target, config.tile.center),
      bounds: config.tile.size.every(dimension => dimension > 0)
        ? getTileBounds(config.tile.size, config.tile.tilesOffset)
        : null,
      sources: {
        code: scalarSource('code'),
        name: scalarSource('name'),
        center: coordinateSources('center', center),
        size: coordinateSources('size', size),
        extension: scalarSource('extension'),
        tilesOffset: coordinateSources('tilesOffset', tilesOffset),
        'settings.center': hasBuiltinTarget
          ? [`AREA_ADDITIONAL_CONFIG_MAP[${JSON.stringify(areaCode)}].target`]
          : coordinateSources('settings.center', configuredTarget),
        'settings.zoom': scalarSource('settings.zoom'),
      },
      fragments: [...areaFragments, ...templateFragments],
    })
  }
  return result
}
