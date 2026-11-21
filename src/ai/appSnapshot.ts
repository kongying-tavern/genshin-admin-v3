import type { BridgeAccess, ModeSource, SnapshotContext, SnapshotSection } from '@/ai/types'
import type { ArchiveData } from '@/stores/archive'
import { toValue } from 'vue'
import {
  AI_BRIDGE_PROTOCOL_VERSION,
  AI_BRIDGE_SCHEMA_VERSION,
  SNAPSHOT_SECTION_KEYS,
} from '@/ai/constants'
import { getGlobalDialogState } from '@/components/AppDialog/state'
import { getSettingsDialogState } from '@/components/AppSettings/open'
import { getUserInfoDialogState } from '@/components/AppUserInfo/open'
import { noticeContext } from '@/components/AppNotice/context'
import { useAppWindow } from '@/components/AppWindow'
import { useTheme } from '@/hooks/useTheme'
import { router } from '@/router'
import { listDatasets, toDatasetStatus } from '@/stores/datasetStatus'
import { ACCESS_BINARY_MASK, useAccessStore } from '@/stores/access'
import { useArchiveStore } from '@/stores/archive'
import { useAreaStore } from '@/stores/area'
import { useDadianStore } from '@/stores/dadian'
import { useIconStore } from '@/stores/icon'
import { useItemStore } from '@/stores/item'
import { useItemTypeStore } from '@/stores/itemType'
import { useMarkerStore } from '@/stores/marker'
import { useMarkerLinkStore } from '@/stores/markerLink'
import { useMapStateStore } from '@/stores/mapState'
import { useNoticeStore } from '@/stores/notice'
import { useOverlayStore } from '@/stores/overlay'
import { usePreferenceStore } from '@/stores/userPreference'
import { useSocketStore } from '@/stores/socket'
import { useTileStore } from '@/stores/tile'
import { useUserStore } from '@/stores/user'
import { getMapContext, inspectSurfaces, listForms, summarizeForm } from './bindings'

export interface AppSnapshotSectionOptions {
  mode: BridgeAccess
  modeSource: ModeSource
  installedAt: number
}

const safeBuild = (fn: () => unknown): unknown => {
  try {
    return fn()
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

const pickUser = (info: Record<string, unknown> | null) => {
  if (!info) return null
  const role = toRecord(info.role)
  return {
    id: info.id,
    username: info.username,
    nickname: info.nickname,
    logo: info.logo,
    role: info.role
      ? {
          id: role.id,
          name: role.name,
          code: role.code,
          mask: role.mask,
        }
      : null,
  }
}

const mapSetEntries = (value: unknown): [string, unknown[]][] => {
  const map = toValue(value) as Map<string, Set<unknown>> | undefined
  if (!(map instanceof Map)) return []
  return [...map.entries()].map(([key, set]) => {
    const items = toValue(set) as Set<unknown>
    return [key, items instanceof Set ? [...items] : []]
  })
}

const buildAppSection = (options: AppSnapshotSectionOptions, context: SnapshotContext) => {
  const route = router.currentRoute.value
  return {
    title: import.meta.env.VITE_TITLE,
    version: import.meta.env.APP_VERSION ?? '',
    branch: import.meta.env.APP_BRANCH ?? '',
    commitHash: import.meta.env.APP_COMMIT_HASH ?? '',
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    url: window.location.href,
    route: {
      path: route.path,
      fullPath: route.fullPath,
      query: { ...route.query },
    },
    bridge: {
      protocolVersion: AI_BRIDGE_PROTOCOL_VERSION,
      schemaVersion: AI_BRIDGE_SCHEMA_VERSION,
      mode: options.mode,
      modeSource: options.modeSource,
      installedAt: options.installedAt,
    },
    now: context.now(),
  }
}

/** 登录态（供 auth.status 与快照共用） */
export const getAuthStatus = () => {
  const userStore = useUserStore()
  const accessStore = useAccessStore()
  const auth = toRecord(toValue(userStore.auth))
  const info = toValue(userStore.info) as Record<string, unknown> | null
  const expiresTime = Number(auth.expiresTime ?? 0)
  return {
    isLogin: userStore.isLogin,
    loginDialogVisible: !userStore.isLogin,
    hasToken: Boolean(auth.accessToken),
    tokenExpiresAt: expiresTime || 0,
    tokenExpiresInMs: Math.max(0, expiresTime - Date.now()),
    autoRefreshActive: Boolean(toValue(userStore.isAutoRefreshActive)),
    user: pickUser(info),
    hiddenFlagMask: toValue(accessStore.userHiddenFlagMask),
    permissions: Object.fromEntries(
      (Object.keys(ACCESS_BINARY_MASK) as (keyof typeof ACCESS_BINARY_MASK)[]).map(key => [
        key,
        accessStore.get(key),
      ]),
    ),
  }
}

const buildAuthSection = (_options: AppSnapshotSectionOptions, _context: SnapshotContext) =>
  getAuthStatus()

const buildUiSection = (_options: AppSnapshotSectionOptions, context: SnapshotContext) => {
  const appWindow = useAppWindow()
  const windows = context.includeWindowStates
    ? [...appWindow.getWindows().values()].map(info => ({
        id: info.id,
        name: info.name,
        sizeState: info.sizeState,
        interactionState: info.interactionState,
        order: info.order,
        size: info.size,
        translate: info.translate,
      }))
    : []

  const noticeStore = useNoticeStore()
  const theme = useTheme()

  return {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
      visibilityState: document.visibilityState,
    },
    theme: {
      isDark: Boolean(toValue(theme.isDark)),
    },
    surfaces: inspectSurfaces({
      includeState: context.includeSurfaceStates,
    }),
    windows,
    dialogs: getGlobalDialogState(),
    settings: getSettingsDialogState(),
    userInfo: getUserInfoDialogState(),
    notices: {
      visible: Boolean(toValue(noticeContext.visible)),
      unread: toValue(noticeStore.newCount),
      total: toValue(noticeStore.noticeList).length,
    },
    forms: listForms().map(summarizeForm),
  }
}

/** 地图状态（供 map.state 与快照共用） */
export const getMapState = () => {
  const preferenceStore = usePreferenceStore()
  const tileStore = useTileStore()
  const mapStateStore = useMapStateStore()
  const markerStore = useMarkerStore()
  const archiveStore = useArchiveStore()
  const overlayStore = useOverlayStore()
  const mapContext = getMapContext()

  const rawViewState = mapContext?.getViewState?.()
  const viewState = toRecord(toValue(rawViewState))
  const target = Array.isArray(viewState.target)
    ? viewState.target.slice(0, 2).map(value => Number(value))
    : undefined
  const markerView =
    target && target.length === 2 && tileStore.currentTileConfig
      ? tileStore.toMarkerCoordinate([target[0], target[1]])
      : undefined

  const interaction = mapStateStore.interaction
  const currentTileConfig = tileStore.currentTileConfig
  const archive = toValue(archiveStore.currentArchive) as ArchiveData

  return {
    areaCode: preferenceStore.areaCode,
    parentAreaCode: preferenceStore.parentAreaCode,
    tileCode: currentTileConfig?.tile.code ?? '',
    tileName: currentTileConfig?.tile.name ?? '',
    viewState: {
      zoom: viewState.zoom,
      minZoom: viewState.minZoom,
      maxZoom: viewState.maxZoom,
      target,
      transitionDuration: viewState.transitionDuration,
    },
    markerView: markerView ? { x: markerView[0], y: markerView[1], zoom: viewState.zoom } : null,
    container: mapContext?.getContainerSize?.() ?? null,
    isViewPortLocked: Boolean(toValue(mapStateStore.isViewPortLocked)),
    cursor: toValue(mapStateStore.cursor),
    mission: toValue(mapStateStore.mission),
    interaction: {
      isPopoverOnHover: Boolean(toValue(interaction.isPopoverOnHover)),
      hover: mapSetEntries(interaction.hoverElements),
      focus: mapSetEntries(interaction.focusElements),
      timestamp: toValue(interaction.interactionTimestamp),
    },
    counts: {
      all: toValue(markerStore.total),
      filtered: toValue(mapStateStore.staticMarkers).length,
      currentLayer: toValue(mapStateStore.currentLayerMarkers).length,
      current: toValue(mapStateStore.currentMarkers).length,
      temp: toValue(mapStateStore.tempMarkers).length,
      archived: archive.body.Data_KYJG.size,
    },
    filter: {
      type: toValue(mapStateStore.markerFilterType),
      basic: {
        areaCode: preferenceStore.areaCode,
        parentAreaCode: preferenceStore.parentAreaCode,
        itemTypeId: preferenceStore.itemTypeId,
        itemIds: [...preferenceStore.itemIds],
        step: preferenceStore.step,
      },
      advanced: {
        active: preferenceStore.advancedFilter,
        cache: preferenceStore.advancedFilterCache,
        count: toValue(mapStateStore.markerAdvancedCount),
        cacheCount: toValue(mapStateStore.markerAdvancedCacheCount),
      },
    },
    settings: {
      hideMarkerPopover: Boolean(archiveStore.preference['map.setting.hideMarkerPopover']),
      showZoneTag: preferenceStore.showZoneTag,
      transparentMarked: preferenceStore.transparentMarked,
    },
    overlay: {
      showMask: Boolean(toValue(overlayStore.showMask)),
      activeCount: toValue(overlayStore.activedItems).length,
      existingCount: toValue(overlayStore.existOverlays).length,
      visibleChunks: toValue(overlayStore.visibleChunks),
    },
  }
}

const buildMapSection = (_options: AppSnapshotSectionOptions, _context: SnapshotContext) =>
  getMapState()

const buildResourcesSection = (_options: AppSnapshotSectionOptions, _context: SnapshotContext) => {
  const areaStore = useAreaStore()
  const iconStore = useIconStore()
  const itemStore = useItemStore()
  const itemTypeStore = useItemTypeStore()
  const markerStore = useMarkerStore()
  const markerLinkStore = useMarkerLinkStore()
  const preferenceStore = usePreferenceStore()
  const accessStore = useAccessStore()
  const dadianStore = useDadianStore()

  const currentArea = areaStore.areaCodeMap.get(preferenceStore.areaCode)

  return {
    counts: {
      areas: toValue(areaStore.total),
      icons: toValue(iconStore.total),
      items: toValue(itemStore.total),
      itemTypes: toValue(itemTypeStore.total),
      markers: toValue(markerStore.total),
      markerLinks: toValue(markerLinkStore.total),
    },
    currentArea: currentArea
      ? {
          id: currentArea.id,
          code: currentArea.code,
          name: currentArea.name,
          parentId: currentArea.parentId,
        }
      : null,
    hiddenFlagMask: toValue(accessStore.userHiddenFlagMask),
    systemConfig: {
      version: dadianStore.meta.version,
      digest: dadianStore.meta.digest,
    },
  }
}

const buildDatasetsSection = (_options: AppSnapshotSectionOptions, _context: SnapshotContext) =>
  listDatasets().map(dataset => toDatasetStatus(dataset))

const buildArchiveSection = (_options: AppSnapshotSectionOptions, _context: SnapshotContext) => {
  const archiveStore = useArchiveStore()
  const archive = toValue(archiveStore.currentArchive) as ArchiveData
  return {
    slotIndex: archive.slotIndex,
    markedCount: archive.body.Data_KYJG.size,
    timestamp: archive.timestamp,
    fetchLoading: Boolean(toValue(archiveStore.fetchLoading)),
  }
}

const buildSocketSection = (_options: AppSnapshotSectionOptions, _context: SnapshotContext) => {
  const socketStore = useSocketStore()
  const context = toRecord(toValue(socketStore.context))
  const messages = toValue(socketStore.messageList) as Array<{ time?: number }>
  const lastMessage = messages[messages.length - 1]
  return {
    status: context.status,
    delay: context.delay,
    id: context.id,
    messageCount: messages.length,
    lastMessageAt: lastMessage?.time ?? 0,
  }
}

const buildFormsSection = (_options: AppSnapshotSectionOptions, _context: SnapshotContext) =>
  listForms().map(form => ({
    ...summarizeForm(form),
    fields: form.fields?.map(field => field.key) ?? [],
  }))

const SECTION_BUILDERS: Record<
  (typeof SNAPSHOT_SECTION_KEYS)[number],
  (options: AppSnapshotSectionOptions, context: SnapshotContext) => unknown
> = {
  app: buildAppSection,
  auth: buildAuthSection,
  ui: buildUiSection,
  map: buildMapSection,
  resources: buildResourcesSection,
  datasets: buildDatasetsSection,
  archive: buildArchiveSection,
  socket: buildSocketSection,
  forms: buildFormsSection,
}

const SECTION_TITLES: Record<(typeof SNAPSHOT_SECTION_KEYS)[number], string> = {
  app: '应用信息',
  auth: '登录态',
  ui: '界面状态',
  map: '地图状态',
  resources: '资源统计',
  datasets: '本地数据更新状态',
  archive: '存档状态',
  socket: 'WebSocket 状态',
  forms: '表单状态',
}

/** 创建真实快照 section */
export const createAppSnapshotSections = (options: AppSnapshotSectionOptions): SnapshotSection[] =>
  SNAPSHOT_SECTION_KEYS.map(key => ({
    key,
    title: SECTION_TITLES[key],
    build: context => safeBuild(() => SECTION_BUILDERS[key](options, context)),
  }))
