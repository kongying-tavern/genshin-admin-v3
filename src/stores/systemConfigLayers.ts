import type { OverlayChunk, OverlayChunkGroup } from '@/packages/map'
import type { AreaTileConfig } from './tile'
import { defaultsDeep, get, merge, pick } from 'lodash'
import { toMapCoordinate } from '@/packages/map/src/utils/mapCoordinates'
import { UrlTemplate } from '@/utils/url-template'

type PluginSection = 'plugins' | 'pluginsBeta'
type FieldPath = (string | number)[]

const pluginPath = (section: PluginSection, areaCode: string, path: FieldPath) => {
  const suffix = path
    .map(key => {
      if (typeof key === 'number') return `[${key}]`
      if (/^[\w$]+$/.test(key) && !/^\d/.test(key)) return `.${key}`
      return `[${JSON.stringify(key)}]`
    })
    .join('')
  return `${section}[${JSON.stringify(areaCode)}]${suffix}`
}

export interface OverlayBoundsDetails {
  pointBounds?: DTO.OverlayBounds
  mapBounds?: DTO.OverlayBounds
  sourcePaths: string[]
  reason?: string
}

export interface OverlaySegmentDetails {
  id: string
  name: string
  bounds: OverlayBoundsDetails
}

export interface OverlayItemDetails extends OverlaySegmentDetails {
  chunks: OverlaySegmentDetails[]
}

export interface OverlayGroupDetails extends OverlaySegmentDetails {
  role: DTO.OverlayRole
  multiple: boolean
  items: OverlayItemDetails[]
}

const isCoordinate = (value: unknown): value is DTO.Coordinate2D =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)

const isBounds = (value: unknown): value is DTO.OverlayBounds =>
  Array.isArray(value) && value.length === 2 && value.every(isCoordinate)

const boundCoordinates = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
]

const resolveBounds = (
  bounds: unknown,
  path: FieldPath,
  areaCode: string,
  origin: DTO.Coordinate2D | undefined,
  formal: DTO.PluginConfig | undefined,
  beta: DTO.PluginConfig | undefined,
): OverlayBoundsDetails => {
  if (bounds === undefined) return { sourcePaths: [], reason: '配置未提供边界' }

  const formalBounds: unknown = get(formal, path)
  const betaBounds: unknown = get(beta, path)
  const valid = isBounds(bounds)
  const useFormal = valid
    ? boundCoordinates.some(
        index => get(formalBounds, index) !== undefined && get(betaBounds, index) === undefined,
      )
    : formalBounds !== undefined && (betaBounds === undefined || Array.isArray(betaBounds))
  const useBeta = valid
    ? boundCoordinates.some(index => get(betaBounds, index) !== undefined)
    : betaBounds !== undefined
  const sourcePaths: string[] = []
  if (useFormal) {
    sourcePaths.push(pluginPath('plugins', areaCode, path))
  }
  if (useBeta) sourcePaths.push(pluginPath('pluginsBeta', areaCode, path))

  if (!valid) return { sourcePaths, reason: '边界需要两组有效的点位坐标' }
  if (!isCoordinate(origin))
    return { pointBounds: bounds, sourcePaths, reason: '缺少有效的点位原点' }

  return {
    pointBounds: bounds,
    mapBounds: [toMapCoordinate(bounds[0], origin), toMapCoordinate(bounds[1], origin)],
    sourcePaths,
  }
}

/** 用于主地图渲染与配置查看的同一份叠层解析结果。 */
export const resolveOverlayConfig = (
  config: DTO.DadianJSON,
  hasBeta: boolean,
  tiles: Readonly<Record<string, AreaTileConfig>>,
) => {
  const formal = config.plugins ?? {}
  const beta = hasBeta ? config.pluginsBeta : undefined
  const plugins = merge({}, formal, beta)
  const enabledAreas = new Set<string>()
  const groupsByArea = new Map<string, OverlayGroupDetails[]>()
  const resultMap = new Map<string, OverlayChunk>()
  const groupCache = new Map<string, OverlayChunkGroup>()

  for (const [areaCode, plugin] of Object.entries(plugins)) {
    if (!plugin.overlay) continue
    enabledAreas.add(areaCode)
    const overlayConfig = plugin.overlayConfig ?? {}
    const tile = tiles[areaCode]
    const readBounds = (bounds: unknown, path: FieldPath) =>
      resolveBounds(
        bounds,
        [...path, 'bounds'],
        areaCode,
        tile?.tile.center,
        formal[areaCode],
        beta?.[areaCode],
      )

    const groups = (overlayConfig.overlays ?? []).map((groupOption, groupIndex) => {
      const {
        label: groupLabel = 'unknown group',
        value: groupValue = `[G]${crypto.randomUUID()}`,
        children = [],
        url: groupUrl,
        urlTemplate: groupUrlTemplate = overlayConfig.urlTemplate,
        role = 'default',
        multiple = overlayConfig.multiple ?? false,
      } = groupOption
      // 延续原始分组展开时对直接填写 id、mask 和 items 的兼容。
      const {
        id: groupId,
        mask = false,
        items: groupItems,
      } = {
        id: `group-${crypto.randomUUID()}`,
        mask: overlayConfig.overlayMask ?? false,
        items: children,
        ...groupOption,
      }
      const groupPath = ['overlayConfig', 'overlays', groupIndex]
      const groupBounds = readBounds(groupOption.bounds, groupPath)

      let group = groupCache.get(groupValue)
      if (tile) {
        if (!group) {
          group = {
            id: groupId,
            name: groupLabel,
            mask,
            role,
            multiple,
            areaCodes: new Set<string>(),
            areaIndexes: new Map<string, number>(),
          }
          groupCache.set(groupValue, group)
        }
        group.areaCodes.add(areaCode)
        group.areaIndexes.set(areaCode, groupIndex)
      }

      const itemsKey = Object.hasOwn(groupOption, 'items') ? 'items' : 'children'
      const items = groupItems.map((itemOption, itemIndex) => {
        const {
          label: itemLabel = 'unknown item',
          value: itemValue = crypto.randomUUID(),
          url: itemUrl = groupUrl,
          urlTemplate: itemUrlTemplate = groupUrlTemplate,
          chunks = [],
        } = itemOption
        const itemPath = [...groupPath, itemsKey, itemIndex]
        const itemBounds =
          itemOption.bounds === undefined ? groupBounds : readBounds(itemOption.bounds, itemPath)
        const item = { id: `${groupValue}-->${itemValue}`, name: itemLabel }
        const templater = new UrlTemplate(itemUrlTemplate ?? '')
        templater.compile({ groupLabel, groupValue, itemLabel, itemValue })

        const addChunk = (
          id: string,
          label: string,
          url: string,
          { mapBounds }: OverlayBoundsDetails,
        ) => {
          if (!mapBounds || !group) return
          const existing = resultMap.get(url)
          if (existing) {
            existing.areaCodes.add(areaCode)
            return
          }
          resultMap.set(id, {
            id,
            label,
            url,
            bounds: mapBounds,
            group,
            item,
            areaCodes: new Set([areaCode]),
          })
        }

        if (!chunks.length)
          addChunk(item.id, itemLabel, itemUrl ?? templater.toString(), itemBounds)

        const segments = chunks.map((chunkOption, chunkIndex) => {
          const {
            label: chunkLabel = 'unknown chunk',
            value: chunkValue = crypto.randomUUID(),
            url: chunkUrl = itemUrl,
          } = chunkOption
          const chunkPath = [...itemPath, 'chunks', chunkIndex]
          const chunkBounds =
            chunkOption.bounds === undefined
              ? itemBounds
              : readBounds(chunkOption.bounds, chunkPath)
          templater.compile({ chunkLabel, chunkValue })
          addChunk(
            `${item.id}-->${chunkValue}`,
            chunkLabel,
            chunkUrl || templater.toString(),
            chunkBounds,
          )
          return {
            id: String(chunkIndex),
            name: chunkOption.label ?? '未命名分片',
            bounds: chunkBounds,
          }
        })
        return {
          id: String(itemIndex),
          name: itemOption.label ?? '未命名叠层项',
          bounds: itemBounds,
          chunks: segments,
        }
      })

      return {
        id: String(groupIndex),
        name: groupOption.label ?? '未命名分组',
        role: group?.role ?? role,
        multiple: group?.multiple ?? multiple,
        bounds: groupBounds,
        items,
      }
    })
    groupsByArea.set(areaCode, groups)
  }

  return { enabledAreas, groupsByArea, chunks: Array.from(resultMap.values()) }
}

export interface EnabledExtraDetails {
  key: string
  config: unknown
  sourcePaths: string[]
}

const extraKeys = (plugin: DTO.PluginConfig | undefined) => {
  const keys = plugin?.extra
  if (typeof keys === 'string') return [keys]
  return keys ?? []
}

const suppliesDefault = (formal: unknown, beta: unknown): boolean => {
  if (beta === undefined) return false
  if (formal === undefined) return true
  if (!formal || typeof formal !== 'object' || !beta || typeof beta !== 'object') return false
  return Object.entries(beta).some(([key, value]) => suppliesDefault(get(formal, [key]), value))
}

/** 正式配置优先，Beta 只启用额外的插件并补充缺省字段。 */
export const resolveMarkerExtras = (config: DTO.DadianJSON, hasBeta: boolean) => {
  const enabledExtrasByArea = new Map<string, EnabledExtraDetails[]>()
  const mergedAreaExtraConfigs: Record<string, DTO.ExtraConfig> = {}

  for (const [areaCode, formal] of Object.entries(config.plugins ?? {})) {
    const beta = hasBeta ? config.pluginsBeta?.[areaCode] : undefined
    const keys = [...new Set([...extraKeys(formal), ...extraKeys(beta)])]
    const mergedConfig = defaultsDeep({}, formal.extraConfig, beta?.extraConfig)
    mergedAreaExtraConfigs[areaCode] = pick(mergedConfig, keys)

    const extras = keys.map(key => {
      const sourcePaths: string[] = []
      for (const [section, plugin] of [
        ['plugins', formal],
        ['pluginsBeta', beta],
      ] as const) {
        const enabledAt = extraKeys(plugin).indexOf(key)
        if (enabledAt !== -1) {
          const path = Array.isArray(plugin?.extra) ? ['extra', enabledAt] : ['extra']
          sourcePaths.push(pluginPath(section, areaCode, path))
        }
      }
      const formalValue: unknown = get(formal.extraConfig, [key])
      const betaValue: unknown = get(beta?.extraConfig, [key])
      if (formalValue !== undefined) {
        sourcePaths.push(pluginPath('plugins', areaCode, ['extraConfig', key]))
      }
      if (suppliesDefault(formalValue, betaValue)) {
        sourcePaths.push(pluginPath('pluginsBeta', areaCode, ['extraConfig', key]))
      }
      return { key, config: get(mergedAreaExtraConfigs[areaCode], key), sourcePaths }
    })
    enabledExtrasByArea.set(areaCode, extras)
  }

  return { enabledExtrasByArea, mergedAreaExtraConfigs }
}
