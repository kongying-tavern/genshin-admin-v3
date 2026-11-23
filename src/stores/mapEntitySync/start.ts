import type { ItemVo, MarkerVo } from '@/api/alova/globals'
import type {
  DiagnosticLookup,
  DiagnosticMessage,
  DiagnosticReason,
  DiagnosticStep,
} from '@/database/websocket/types'
import type { DetailReadObserver } from './model'
import Apis from '@/api/alova'
import { diagnosticStep } from '@/database/websocket/diagnostics'
import { HistoryRecordType } from '@/shared'
import { useItemStore } from '../item'
import { useMarkerStore } from '../marker'
import { useMarkerLinkStore } from '../markerLink'
import { useSocketStore } from '../socket'
import { useUserStore } from '../user'
import { useMapEntitySync } from './index'
import { isEntityId } from './model'
import { RECHECK_INTERVAL } from './useEntityManager'

interface SocketPush {
  metadata?: DiagnosticMessage
}

export function startMapEntitySync() {
  const sync = useMapEntitySync()
  const socket = useSocketStore()
  const user = useUserStore()
  const marker = useMarkerStore()
  const item = useItemStore()
  const link = useMarkerLinkStore()
  const { ipc, appEvent, recordPageStep } = socket
  type Session = ReturnType<typeof sync.current>

  const recover = (session: Session, cause: unknown, update: () => Promise<unknown>) => {
    sync.reportError(session, cause)
    if (sync.isCurrent(session)) void update()
  }

  const markDispatched = (metadata: DiagnosticMessage | undefined) =>
    recordPageStep(
      metadata,
      diagnosticStep('push-dispatched', 'page', 'success', { settles: 'processing' }),
    )

  const markInterrupted = (
    metadata: DiagnosticMessage | undefined,
    reason: 'scope-unavailable' | 'scope-changed',
  ) =>
    recordPageStep(
      metadata,
      diagnosticStep('interrupted', 'page', 'interrupted', { reason, settles: 'processing' }),
    )

  const markProcessingFailure = (metadata: DiagnosticMessage | undefined) =>
    recordPageStep(
      metadata,
      diagnosticStep('push-processing-failed', 'page', 'failed', {
        reason: 'processing-failed',
        settles: 'processing',
      }),
    )

  const withSocketScope = (
    metadata: DiagnosticMessage | undefined,
    work: (session: Session) => Promise<unknown>,
    update: () => Promise<unknown>,
  ) => {
    if (!sync.scope || !socket.hasCurrentCredentials) {
      markInterrupted(metadata, 'scope-unavailable')
      return
    }
    const session = sync.current()
    void work(session).catch(cause => recover(session, cause, update))
  }

  function batchSocketEvents<T extends SocketPush>(
    lookup: DiagnosticLookup,
    update: () => Promise<unknown>,
    invalidate: (session: Session, value: T) => Promise<unknown>,
    read: (
      session: Session,
      values: T[],
      observer: DetailReadObserver,
      dispatched: (value: T) => void,
    ) => Promise<void>,
    idsOf?: (value: T) => number[],
  ) {
    let batch:
      | { session: Session; entries: { value: T; invalidated: Promise<unknown> }[] }
      | undefined
    return (value: T) =>
      withSocketScope(
        value.metadata,
        async session => {
          const invalidated = invalidate(session, value)
          // 在队列取到这批之前，失效登记可能已经失败。
          void invalidated.catch(() => undefined)
          const entry = { value, invalidated }
          if (batch?.session === session) {
            batch.entries.push(entry)
            return
          }
          const queued = { session, entries: [entry] }
          batch = queued
          let waitingForDetails = false
          const missingDetails = new Map<T, DiagnosticStep>()
          const completed = new Set<T>()
          try {
            await sync.enqueue(session, async () => {
              if (batch === queued) batch = undefined
              await Promise.all(queued.entries.map(entry => entry.invalidated))
              const values = queued.entries.map(entry => entry.value)
              await read(
                session,
                values,
                {
                  start: () => {
                    waitingForDetails = true
                    for (const { metadata } of values)
                      recordPageStep(
                        metadata,
                        diagnosticStep('lookup', 'page', 'processing', { lookup }),
                      )
                  },
                  received: (ids = []) => {
                    waitingForDetails = false
                    const missing = new Set(ids)
                    for (const event of values) {
                      if (idsOf?.(event).some(id => missing.has(id))) {
                        missingDetails.set(
                          event,
                          diagnosticStep('lookup-result', 'page', 'failed', {
                            lookup,
                            reason: 'missing-data',
                            settles: 'processing',
                          }),
                        )
                      } else {
                        recordPageStep(
                          event.metadata,
                          diagnosticStep('lookup-result', 'page', 'success', { lookup }),
                        )
                      }
                    }
                  },
                },
                event => {
                  completed.add(event)
                  markDispatched(event.metadata)
                },
              )
            })
          } finally {
            if (batch === queued) batch = undefined
            for (const { value } of queued.entries) {
              if (completed.has(value)) continue
              const missing = missingDetails.get(value)
              if (missing) recordPageStep(value.metadata, missing)
              else if (!sync.isCurrent(session)) markInterrupted(value.metadata, 'scope-changed')
              else if (waitingForDetails)
                recordPageStep(
                  value.metadata,
                  diagnosticStep('lookup-result', 'page', 'failed', {
                    lookup,
                    reason: 'request-failed',
                    settles: 'processing',
                  }),
                )
              else markProcessingFailure(value.metadata)
            }
          }
        },
        update,
      )
  }

  const markerEvents = batchSocketEvents<
    SocketPush & { event: 'MarkerAdded' | 'MarkerUpdated' | 'MarkerTweaked'; ids: number[] }
  >(
    'marker',
    marker.update,
    (session, event) => sync.invalidate(session, 'marker', event.ids),
    async (session, events, observer, dispatched) => {
      const { markers, users } = await marker.readMarkers(
        session,
        [...new Set(events.flatMap(e => e.ids))],
        observer,
      )
      if (!sync.isCurrent(session)) return
      const index = new Map(markers.map(row => [row.id, row]))
      for (const entry of events) {
        const { event, ids } = entry
        if (event === 'MarkerTweaked') {
          const rows = ids.flatMap(id => (index.get(id) ? [index.get(id)!] : []))
          if (rows.length) {
            const uid = rows[0].updaterId
            appEvent.emit(event, rows, Object.assign({ id: uid }, users[uid!]))
            dispatched(entry)
          }
        } else {
          const row = index.get(ids[0])
          if (row) {
            const uid = event === 'MarkerAdded' ? row.creatorId : row.updaterId
            appEvent.emit(event, row, Object.assign({ id: uid }, users[uid!]))
            dispatched(entry)
          }
        }
      }
    },
    event => event.ids,
  )
  const itemEvents = batchSocketEvents<
    SocketPush & { event: 'ItemAdded' | 'ItemUpdated'; id: number }
  >(
    'item',
    item.update,
    (session, event) => sync.invalidate(session, 'item', [event.id]),
    async (session, events, observer, dispatched) => {
      const { items, users } = await item.readItems(
        session,
        [...new Set(events.map(e => e.id))],
        observer,
      )
      if (!sync.isCurrent(session)) return
      const index = new Map(items.map(row => [row.id, row]))
      for (const entry of events) {
        const { event, id } = entry
        const row = index.get(id)
        if (row) {
          const uid = event === 'ItemAdded' ? row.creatorId : row.updaterId
          appEvent.emit(event, row, Object.assign({ id: uid }, users[uid!]))
          dispatched(entry)
        }
      }
    },
    event => [event.id],
  )

  const linkEvents = batchSocketEvents<SocketPush & WebSocketAPI.WSMarkerLinkData>(
    'linkage',
    link.update,
    (session, event) => link.trackLinkChange(session, event),
    async (session, events, observer, dispatched) => {
      const change = {
        groups: [...new Set(events.flatMap(event => event.groups))],
        markers: [...new Set(events.flatMap(event => event.markers))],
      }
      const { markers, user } = await link.readLinkChange(session, change, observer)
      if (!sync.isCurrent(session)) return
      appEvent.emit('MarkerLinked', markers, user)
      for (const entry of events) dispatched(entry)
    },
  )

  const deleteEntity = (resource: 'marker' | 'item', id: number, metadata?: DiagnosticMessage) => {
    if (!isEntityId(id)) {
      markProcessingFailure(metadata)
      return
    }
    const lookup = resource === 'marker' ? 'marker-history' : 'item-history'
    withSocketScope(
      metadata,
      async session => {
        try {
          const previous = sync.projection.entities[resource].get(id)
          // 删除先按原始消息 ID 事务落库。历史查询仅补通知文案。
          await sync.remove(session, resource, [id])
          recordPageStep(metadata, diagnosticStep('lookup', 'page', 'processing', { lookup }))
          const history = await Apis.history
            .searchHistory({
              data: {
                current: 0,
                id: [id],
                size: 1,
                sort: ['updateTime-'],
                type: resource === 'marker' ? HistoryRecordType.MARKER : HistoryRecordType.ITEM,
              },
            })
            .catch(() => undefined)
          const entry = history?.data?.record?.[0]
          let details = previous
          let reason: DiagnosticReason | undefined
          if (entry?.content) {
            try {
              details = JSON.parse(entry.content) ?? previous
            } catch {
              reason = 'invalid-details'
            }
          } else {
            reason = history ? 'missing-data' : 'request-failed'
          }
          recordPageStep(
            metadata,
            diagnosticStep('lookup-result', 'page', reason ? 'failed' : 'success', {
              lookup,
              reason,
            }),
          )
          if (!sync.isCurrent(session)) {
            markInterrupted(metadata, 'scope-changed')
            return
          }
          const uid = entry?.creatorId
          const user = Object.assign({ id: uid }, history?.users?.[uid ?? 0])
          if (resource === 'marker')
            appEvent.emit('MarkerDeleted', { ...details, id } as MarkerVo, user)
          else appEvent.emit('ItemDeleted', { ...details, id } as ItemVo, user)
          markDispatched(metadata)
        } catch (cause) {
          if (sync.isCurrent(session)) markProcessingFailure(metadata)
          else markInterrupted(metadata, 'scope-changed')
          throw cause
        }
      },
      resource === 'marker' ? marker.update : item.update,
    )
  }

  ipc.onWithMetadata('MarkerAdded', (metadata, id) => {
    if (isEntityId(id)) markerEvents({ event: 'MarkerAdded', ids: [id], metadata })
    else markProcessingFailure(metadata)
  })
  ipc.onWithMetadata('MarkerUpdated', (metadata, id) => {
    if (isEntityId(id)) markerEvents({ event: 'MarkerUpdated', ids: [id], metadata })
    else markProcessingFailure(metadata)
  })
  ipc.onWithMetadata('MarkerTweaked', (metadata, ids) => {
    if (Array.isArray(ids))
      markerEvents({ event: 'MarkerTweaked', ids: ids.filter(isEntityId), metadata })
    else markProcessingFailure(metadata)
  })
  ipc.onWithMetadata('MarkerDeleted', (metadata, id) => deleteEntity('marker', id, metadata))
  ipc.onWithMetadata('ItemAdded', (metadata, id) => {
    if (isEntityId(id)) itemEvents({ event: 'ItemAdded', id, metadata })
    else markProcessingFailure(metadata)
  })
  ipc.onWithMetadata('ItemUpdated', (metadata, id) => {
    if (isEntityId(id)) itemEvents({ event: 'ItemUpdated', id, metadata })
    else markProcessingFailure(metadata)
  })
  ipc.onWithMetadata('ItemDeleted', (metadata, id) => deleteEntity('item', id, metadata))
  ipc.onWithMetadata('MarkerLinked', (metadata, payload) => {
    if (!payload || !Array.isArray(payload.groups) || !Array.isArray(payload.markers)) {
      markProcessingFailure(metadata)
      if (sync.scope && socket.hasCurrentCredentials) void link.update()
      return
    }
    linkEvents({
      groups: payload.groups.filter(group => typeof group === 'string' && group.length > 0),
      markers: payload.markers.filter(isEntityId),
      metadata,
    })
  })

  const recheck = async (online = false) => {
    if (!sync.scope || !sync.online) return
    const session = sync.current()
    let state: typeof sync.projection.state
    try {
      state = (await sync.refresh(session)).state
    } catch (cause) {
      sync.reportError(session, cause)
      return
    }
    const itemArchive = state.resources.item?.archiveKey
    const linkArchive = state.resources.markerLink?.archiveKey
    void item.update({ isFull: online }).then(() => {
      if (
        !online
        && sync.isCurrent(session)
        && item.syncState?.archiveKey
        && (item.syncState.archiveKey !== itemArchive
          || Date.now() - item.syncState.checkedAt > RECHECK_INTERVAL)
      )
        void item.update({ isFull: true })
    })
    void marker.update()
    void link.update({ isFull: online }).then(() => {
      if (
        !online
        && sync.isCurrent(session)
        && link.syncState?.checkedAt
        && link.syncState.archiveKey !== linkArchive
      )
        void link.update({ isFull: true })
    })
  }

  let lastFullCheck = 0
  const recoverOnline = async (foreground = false) => {
    if (!sync.scope || !sync.online || (foreground && Date.now() - lastFullCheck < 60_000)) return
    lastFullCheck = Date.now()
    const session = sync.current()
    await user.refreshUserInfo()
    if (sync.isCurrent(session)) await recheck(true)
  }

  appEvent.on('MarkerBinaryPurged', () => {
    if (socket.hasCurrentCredentials) void marker.update()
  })
  appEvent.on('ItemBinaryPurged', () => {
    if (!sync.scope || !socket.hasCurrentCredentials) return
    const session = sync.current()
    const previous = item.syncState?.archiveKey
    void item.update().then(() => {
      if (sync.isCurrent(session) && item.syncState?.archiveKey !== previous)
        void item.update({ isFull: true })
    })
  })
  appEvent.on('MarkerLinkageBinaryPurged', () => {
    if (!sync.scope || !socket.hasCurrentCredentials) return
    const session = sync.current()
    const previous = link.syncState?.archiveKey
    void link.update().then(() => {
      if (sync.isCurrent(session) && link.syncState?.archiveKey !== previous)
        void link.update({ isFull: true })
    })
  })
  watch(
    () => sync.scope,
    () => {
      void recheck()
    },
    { immediate: true },
  )
  watch(
    () => sync.online,
    online => {
      if (online) void recoverOnline()
    },
  )
  let connectedScope = ''
  watch(
    () => socket.hasCurrentCredentials && socket.context.status === 'OPEN',
    (open, _, onCleanup) => {
      if (!open || !sync.scope) return
      if (connectedScope !== sync.scope) {
        connectedScope = sync.scope
        return
      }
      const timer = window.setTimeout(() => {
        void recoverOnline()
      }, 1000)
      onCleanup(() => window.clearTimeout(timer))
    },
  )
  useEventListener(document, 'visibilitychange', () => {
    if (!document.hidden) void recoverOnline(true)
  })
  useIntervalFn(() => {
    void recoverOnline()
  }, RECHECK_INTERVAL)
}
