import type { BridgeAccess, BridgeCommand, MapAiBridge, ModeSource } from '@/ai/types'
import type { MapWindow } from '@/components/AppWindow/types'
import type { Pinia } from 'pinia'
import { effectScope, toValue, watch } from 'vue'
import { setActivePinia } from 'pinia'
import {
  AI_BRIDGE_DATA_ATTRIBUTE,
  AI_BRIDGE_EVENT_LIMIT,
  AI_BRIDGE_EVENT_TYPES,
  AI_BRIDGE_GLOBAL_NAME,
  AI_BRIDGE_PROTOCOL_VERSION,
  AI_BRIDGE_SCHEMA_VERSION,
  SNAPSHOT_SECTION_KEYS,
} from '@/ai/constants'
import { createEventLog } from '@/ai/events'
import { createBridge } from '@/ai/registry'
import { createSnapshotBuilder } from '@/ai/snapshot'
import { createAppSnapshotSections } from '@/ai/appSnapshot'
import { createCommands } from '@/ai/commands'
import { registerStaticCapabilities } from '@/ai/capabilities'
import { inspectSurfaces } from '@/ai/bindings'
import { buildHelp, buildManifest } from '@/ai/help'
import { noticeContext } from '@/components/AppNotice/context'
import { listDatasets } from '@/stores/datasetStatus'
import { MANAGER_PHASE_LABELS } from '@/stores/hooks'
import { useNoticeStore } from '@/stores/notice'
import { useSocketStore } from '@/stores/socket'
import { useUserStore } from '@/stores/user'
import { watchWindowNames } from './windowState'

export interface InstallAiBridgeOptions {
  mode: BridgeAccess
  source: ModeSource
  pinia?: Pinia
  windows: MapWindow.Reader
}

interface SocketContextLike {
  status?: string
  delay?: number
  id?: string
}

const setupDatasetsWatchers = (
  eventLog: ReturnType<typeof createEventLog>,
  scope: ReturnType<typeof effectScope>,
) => {
  scope.run(() => {
    for (const dataset of listDatasets()) {
      let lastUpdating = dataset.updating()
      let lastPhase = dataset.progress().phase

      if (lastUpdating) {
        eventLog.emit('dataset:update-start', {
          key: dataset.key,
          label: dataset.label,
          startedAt: dataset.progress().startedAt,
        })
      }

      watch(
        () => [dataset.updating(), dataset.progress().status, dataset.progress().phase] as const,
        ([updating, status, phase]) => {
          if (updating && !lastUpdating) {
            eventLog.emit('dataset:update-start', {
              key: dataset.key,
              label: dataset.label,
              startedAt: dataset.progress().startedAt,
            })
          }

          if (updating && phase !== null && phase !== lastPhase) {
            eventLog.emit('dataset:update-phase', {
              key: dataset.key,
              phase,
              phaseLabel: MANAGER_PHASE_LABELS[phase],
              percentage: dataset.progress().percentage,
            })
          }

          if (!updating && lastUpdating) {
            const progress = dataset.progress()
            eventLog.emit('dataset:update-end', {
              key: dataset.key,
              status,
              percentage: progress.percentage,
              error: dataset.error(),
            })
          }

          lastUpdating = updating
          lastPhase = phase
        },
      )
    }
  })
}

const setupAuthWatcher = (
  eventLog: ReturnType<typeof createEventLog>,
  scope: ReturnType<typeof effectScope>,
) => {
  scope.run(() => {
    const userStore = useUserStore()
    let lastLogin = userStore.isLogin
    watch(
      () => userStore.isLogin,
      isLogin => {
        if (isLogin && userStore.info) {
          eventLog.emit('auth:login', {
            userId: userStore.info.id,
            username: userStore.info.username,
          })
        } else if (!isLogin && lastLogin) {
          eventLog.emit('auth:logout', {})
        }
        lastLogin = isLogin
      },
    )
  })
}

const setupSocketWatcher = (
  eventLog: ReturnType<typeof createEventLog>,
  scope: ReturnType<typeof effectScope>,
) => {
  scope.run(() => {
    const socketStore = useSocketStore()
    const readContext = () => toValue(socketStore.context) as SocketContextLike
    let lastStatus = readContext().status
    watch(
      () => {
        const context = readContext()
        return [context.status, context.delay] as const
      },
      ([status, delay]) => {
        if (status !== lastStatus) {
          eventLog.emit('socket:status', { status, delay })
        }
        lastStatus = status
      },
    )
  })
}

const setupNoticeWatcher = (
  eventLog: ReturnType<typeof createEventLog>,
  scope: ReturnType<typeof effectScope>,
) => {
  scope.run(() => {
    const noticeStore = useNoticeStore()
    watch(
      () => Boolean(toValue(noticeContext.visible)),
      visible => {
        eventLog.emit(visible ? 'notice:open' : 'notice:close', {
          unread: noticeStore.newCount,
          total: (toValue(noticeStore.noticeList) as unknown[]).length,
        })
      },
    )
  })
}

const setupRuntimeErrorListeners = (eventLog: ReturnType<typeof createEventLog>) => {
  const onError = (event: ErrorEvent) => {
    eventLog.emit('runtime:error', {
      message: event.message,
      source: event.filename,
      stack: event.error instanceof Error ? event.error.stack : undefined,
    })
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    eventLog.emit('runtime:error', {
      message: reason instanceof Error ? reason.message : String(reason),
      source: 'unhandledrejection',
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

/**
 * 安装 AI 页面句柄桥接。
 *
 * 只应由 `main.ts` 在应用挂载后根据模式动态调用。
 */
export const installAiBridge = (options: InstallAiBridgeOptions): (() => void) => {
  if (window.__MAP_AI__) {
    return window.__MAP_AI__.dispose
  }

  if (options.pinia) setActivePinia(options.pinia)

  const installedAt = Date.now()
  const protocolVersion = AI_BRIDGE_PROTOCOL_VERSION
  const schemaVersion = AI_BRIDGE_SCHEMA_VERSION
  const eventLog = createEventLog({ limit: AI_BRIDGE_EVENT_LIMIT })
  const scope = effectScope()
  const unbindStatic = registerStaticCapabilities()
  const removeRuntimeListeners = setupRuntimeErrorListeners(eventLog)

  let bridge: MapAiBridge | undefined
  let commandList: BridgeCommand[] = []

  const buildManifestNow = () =>
    buildManifest({
      mode: options.mode,
      modeSource: options.source,
      protocolVersion,
      schemaVersion,
      commands: commandList,
      surfaces: inspectSurfaces({ includeState: false }),
      snapshotSections: SNAPSHOT_SECTION_KEYS,
      events: AI_BRIDGE_EVENT_TYPES,
    })

  const getHelp = (helpOptions?: { group?: string }) => buildHelp(buildManifestNow(), helpOptions)

  const snapshotBuilder = createSnapshotBuilder(
    createAppSnapshotSections({
      mode: options.mode,
      modeSource: options.source,
      installedAt,
      windows: options.windows,
    }),
  )

  try {
    setupDatasetsWatchers(eventLog, scope)
    setupAuthWatcher(eventLog, scope)
    setupSocketWatcher(eventLog, scope)
    setupNoticeWatcher(eventLog, scope)
    scope.run(() =>
      watchWindowNames(options.windows, payload => eventLog.emit('window:change', payload)),
    )

    commandList = createCommands({
      mode: options.mode,
      modeSource: options.source,
      installedAt,
      eventLog,
      snapshot: snapshotOptions => snapshotBuilder(snapshotOptions),
      getManifest: buildManifestNow,
      getHelp,
    })

    const created = createBridge({
      mode: options.mode,
      modeSource: options.source,
      installedAt,
      commands: commandList,
      eventLog,
      snapshot: snapshotOptions => snapshotBuilder(snapshotOptions),
      manifest: buildManifestNow,
      help: getHelp,
      onDispose: () => {
        scope.stop()
        removeRuntimeListeners()
        unbindStatic()
        if (window.__MAP_AI__ === bridge) {
          delete window.__MAP_AI__
        }
        document.documentElement.removeAttribute(`data-${AI_BRIDGE_DATA_ATTRIBUTE}`)
      },
    })
    bridge = created.bridge

    window.__MAP_AI__ = bridge
    document.documentElement.dataset[AI_BRIDGE_DATA_ATTRIBUTE] = options.mode
    eventLog.emit('bridge:ready', {
      protocolVersion,
      mode: options.mode,
      installedAt,
      globalName: AI_BRIDGE_GLOBAL_NAME,
    })

    return created.dispose
  } catch (error) {
    scope.stop()
    removeRuntimeListeners()
    unbindStatic()
    throw error
  }
}
