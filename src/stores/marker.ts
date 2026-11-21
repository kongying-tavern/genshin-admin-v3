import type { MarkerVo, TweakVo } from '@/api/alova/globals'
import type { MarkerCommand } from './mapEntitySync/model'
import { AddLocation, DeleteLocation, Location } from '@element-plus/icons-vue'
import { liveQuery } from 'dexie'
import { acceptHMRUpdate, defineStore } from 'pinia'
import Apis from '@/api/alova'
import db from '@/database'
import { useAccessStore } from './access'
import { useMapEntitySync } from './mapEntitySync'
import { stageArchive } from './mapEntitySync/archives'
import { sendMarkerCreate } from './mapEntitySync/markerCommands'
import { isEntityId, validateEntities } from './mapEntitySync/model'
import {
  checkDetails,
  fetchMarkerReconciliation,
  verifyMarkerArchive,
} from './mapEntitySync/sources'
import { useEntityManager } from './mapEntitySync/useEntityManager'
import { useSocketStore } from './socket'
import { fetchMarkersWithUsersByIds } from './utils/fetchMarkersByIds'

export const useMarkerStore = defineStore('global-marker', () => {
  const access = useAccessStore()
  const socket = useSocketStore()
  const sync = useMapEntitySync()
  type Session = ReturnType<typeof sync.current>

  const empty = new Map<number, MarkerVo>()
  const idMap = computed(() =>
    sync.projection.state.resources.marker?.baseline ? sync.projection.entities.marker : empty,
  )
  const markerList = computed(() =>
    [...idMap.value.values()].filter(row => access.checkHiddenFlag(row.hiddenFlag)),
  )
  const revision = computed(() => sync.projection.revisions.marker)
  const total = computed(() => markerList.value.length)
  const pendingCreates = shallowRef<MarkerCommand[]>([])

  watch(
    () => sync.scope,
    (scope, _, onCleanup) => {
      pendingCreates.value = []
      if (!scope) return
      const session = sync.current()
      const subscription = liveQuery(() =>
        db.mapMarkerCommand.where('scope').equals(scope).toArray(),
      ).subscribe({
        next: commands => {
          if (sync.isCurrent(session)) pendingCreates.value = commands
        },
        error: cause => sync.reportError(session, cause),
      })
      onCleanup(() => subscription.unsubscribe())
    },
    { immediate: true, flush: 'sync' },
  )

  const finishCreates = async (session: Session) => {
    const commands = await db.mapMarkerCommand.where('scope').equals(session.scope).toArray()
    if (!sync.isCurrent(session)) return
    const completed = commands.filter(
      command => command.markerId && sync.projection.entities.marker.has(command.markerId),
    )
    await db.mapMarkerCommand.bulkDelete(completed.map(({ scope, key }) => [scope, key]))
  }

  const manager = useEntityManager(sync, 'marker', async (session, full, task) => {
    const { state, entities, pending } = await sync.refresh(session)
    const resource = state.resources.marker
    let archiveState: typeof resource
    let rejectedArchiveKey = resource?.rejectedArchiveKey
    const { updates, deletes, missing } = await fetchMarkerReconciliation(
      entities.marker,
      pending.marker,
      full || !resource?.baseline,
      task,
      async detailBatches => {
        const stage = await stageArchive(sync, session, 'marker', resource, {
          maxDownloadPages: detailBatches,
          readUnchanged: full || !resource?.baseline,
        }).catch(() => undefined)
        if (stage?.entities) {
          const compatible = await verifyMarkerArchive(stage.entities).catch(() => undefined)
          if (!compatible) {
            if (compatible === false) rejectedArchiveKey = stage.state.archiveKey
            return undefined
          }
          rejectedArchiveKey = undefined
          archiveState = {
            baseline: false,
            checkedAt: 0,
            ...stage.state,
          }
        }
        return stage?.entities
      },
    )
    return {
      input: {
        revision: state.revision,
        batches: {
          marker: {
            updates,
            deletes,
            state: {
              archiveKey: archiveState?.archiveKey ?? resource?.archiveKey,
              archiveTime: archiveState?.archiveTime ?? resource?.archiveTime,
              archivePages: archiveState?.archivePages ?? resource?.archivePages,
              rejectedArchiveKey,
              ...(missing.length ? {} : { baseline: true, checkedAt: Date.now() }),
              pendingRanges: missing.map(String),
            },
          },
        },
      },
      incomplete: missing.length ? `${missing.length} 个点位详情尚待核对` : undefined,
    }
  })

  async function readMarkers(session: Session, ids: number[]) {
    const { state } = await sync.refresh(session)
    const result = await fetchMarkersWithUsersByIds(ids)
    const missing = checkDetails(result.markers, ids)
    const { conflict } = await sync.commit(session, {
      revision: state.revision,
      batches: { marker: { updates: result.markers } },
    })
    sync.assertCurrent(session)
    if (missing.length || conflict) throw new Error('点位详情尚待核对')
    return {
      markers: ids.flatMap(id => {
        const marker = sync.projection.entities.marker.get(id)
        return marker ? [marker] : []
      }),
      users: result.users,
    }
  }

  const readAfterMutation = async (session: Session, id: number) => {
    try {
      await sync.invalidate(session, 'marker', [id])
      return (await sync.enqueue(session, () => readMarkers(session, [id]))).markers[0]
    } catch (cause) {
      sync.reportError(session, cause)
      if (sync.isCurrent(session)) void manager.update()
      return undefined
    }
  }

  const createMarker = async (form: MarkerVo) => {
    const session = sync.current()
    const record = await sendMarkerCreate(sync, session, form)
    const id = record.markerId!
    // 已接收创建回执，后续失败由同步恢复。立即返回 ID 供表单展示。
    void readAfterMutation(session, id)
      .then(() => finishCreates(session))
      .catch(cause => sync.reportError(session, cause))
    return { id, syncing: true as const }
  }

  const updateMarker = async (form: MarkerVo) => {
    if (!isEntityId(form.id)) throw new Error('点位 ID 无效')
    const session = sync.current()
    const { data, message } = await Apis.marker.updateMarker({ data: form })
    if (!data) throw new Error(message)
    return (await readAfterMutation(session, form.id)) ?? { ...form, syncing: true }
  }

  const deleteMarker = async (id: number) => {
    const session = sync.current()
    const { data, message } = await Apis.marker.deleteMarker({ pathParams: { markerId: id } })
    if (!data) throw new Error(message)
    await sync.remove(session, 'marker', [id])
    return true
  }

  const tweakMarkers = async (tweaks: TweakVo[]) => {
    const session = sync.current()
    const { state } = await sync.refresh(session)
    const { data = [] } = await Apis.marker.tweakMarkers({ data: tweaks })
    const ids = [...validateEntities(data)]
    // 回执可能早于其他写入的响应。版本检查与后续回读共同确认结果。
    const { conflict } = await sync.commit(session, {
      revision: state.revision,
      batches: { marker: { updates: data } },
    })
    if (conflict && sync.isCurrent(session)) {
      await sync.invalidate(session, 'marker', ids)
      void sync
        .enqueue(session, () => readMarkers(session, ids))
        .catch(cause => {
          sync.reportError(session, cause)
          if (sync.isCurrent(session)) void manager.update()
        })
    }
    return data
  }

  socket.appEvent.on('MarkerAdded', (marker, { nickname, username }) => {
    socket.notice('MarkerAdded', {
      message: `${nickname ?? username ?? `(uid: ${marker.creatorId})`} 新增了点位 ${marker.markerTitle} (id:${marker.id})`,
      icon: AddLocation,
      customClass: 'text-[var(--el-color-success)]',
    })
  })
  socket.appEvent.on('MarkerUpdated', (marker, { nickname, username }) => {
    socket.notice('MarkerUpdated', {
      message: `${nickname ?? username ?? `(uid: ${marker.updaterId})`} 更新了点位 ${marker.markerTitle} (id:${marker.id})`,
      icon: Location,
      customClass: 'text-[var(--el-color-primary)]',
    })
  })
  socket.appEvent.on('MarkerDeleted', (marker, { nickname, username }) => {
    socket.notice('MarkerDeleted', {
      message: `${nickname ?? username ?? '其他用户'} 删除了点位 ${marker.markerTitle ?? ''} (id:${marker.id})`,
      icon: DeleteLocation,
      customClass: 'text-[var(--el-color-danger)]',
    })
  })
  socket.appEvent.on('MarkerTweaked', (markers, { nickname, username }) => {
    socket.notice('MarkerTweaked', {
      message: `${nickname ?? username ?? '其他用户'} 批量更新了 ${markers.length} 个点位`,
      icon: Location,
      customClass: 'text-[var(--el-color-success)]',
    })
  })

  const update = async (options?: { isFull?: boolean }) => {
    if (!sync.scope) return
    const session = sync.current()
    await manager.update(options)
    if (!sync.isCurrent(session)) return
    try {
      const commands = await db.mapMarkerCommand.where('scope').equals(session.scope).toArray()
      const ids = commands.flatMap(({ markerId }) =>
        markerId && !sync.projection.entities.marker.has(markerId) ? [markerId] : [],
      )
      if (ids.length) {
        await sync.invalidate(session, 'marker', ids)
        await sync.enqueue(session, () => readMarkers(session, ids))
      }
      await finishCreates(session)
    } catch (cause) {
      sync.reportError(session, cause)
    }
  }

  const acknowledgeUnknownCreate = async (key: string) => {
    const session = sync.current()
    await db.transaction('rw', db.mapMarkerCommand, async () => {
      const record = await db.mapMarkerCommand.get([session.scope, key])
      sync.assertCurrent(session)
      if (
        record?.status === 'unknown'
        || (record?.status === 'sending' && Date.now() - record.createdAt > 5 * 60 * 1000)
      )
        await db.mapMarkerCommand.delete([session.scope, key])
    })
  }

  return {
    ...manager,
    update,
    idMap,
    markerList,
    revision,
    total,
    readMarkers,
    createMarker,
    updateMarker,
    deleteMarker,
    tweakMarkers,
    pendingCreates,
    acknowledgeUnknownCreate,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMarkerStore, import.meta.hot))
}
