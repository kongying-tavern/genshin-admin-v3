import type { ItemVo, MarkerVo } from '@/api/alova/globals'
import Apis from '@/api/alova'
import { HistoryRecordType } from '@/shared'
import { useItemStore } from '../item'
import { useMarkerStore } from '../marker'
import { useMarkerLinkStore } from '../markerLink'
import { useSocketStore } from '../socket'
import { useUserStore } from '../user'
import { useMapEntitySync } from './index'
import { isEntityId } from './model'
import { RECHECK_INTERVAL } from './useEntityManager'

export function startMapEntitySync() {
  const sync = useMapEntitySync()
  const socket = useSocketStore()
  const user = useUserStore()
  const marker = useMarkerStore()
  const item = useItemStore()
  const link = useMarkerLinkStore()
  const { ipc, appEvent } = socket
  type Session = ReturnType<typeof sync.current>

  const recover = (session: Session, cause: unknown, update: () => Promise<unknown>) => {
    sync.reportError(session, cause)
    if (sync.isCurrent(session)) void update()
  }

  const withSocketScope = (
    work: (session: Session) => Promise<unknown>,
    update: () => Promise<unknown>,
  ) => {
    if (!sync.scope || !socket.hasCurrentCredentials) return
    const session = sync.current()
    void work(session).catch(cause => recover(session, cause, update))
  }

  function batchSocketEvents<T>(
    update: () => Promise<unknown>,
    invalidate: (session: Session, value: T) => Promise<unknown>,
    read: (session: Session, values: T[]) => Promise<void>,
  ) {
    let batch:
      | { session: Session; entries: { value: T; invalidated: Promise<unknown> }[] }
      | undefined
    return (value: T) =>
      withSocketScope(async session => {
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
        try {
          await sync.enqueue(session, async () => {
            if (batch === queued) batch = undefined
            await Promise.all(queued.entries.map(entry => entry.invalidated))
            await read(
              session,
              queued.entries.map(entry => entry.value),
            )
          })
        } finally {
          if (batch === queued) batch = undefined
        }
      }, update)
  }

  const markerEvents = batchSocketEvents(
    marker.update,
    (session, event: { event: 'MarkerAdded' | 'MarkerUpdated' | 'MarkerTweaked'; ids: number[] }) =>
      sync.invalidate(session, 'marker', event.ids),
    async (session, events) => {
      const { markers, users } = await marker.readMarkers(session, [
        ...new Set(events.flatMap(e => e.ids)),
      ])
      if (!sync.isCurrent(session)) return
      const index = new Map(markers.map(row => [row.id, row]))
      for (const { event, ids } of events) {
        if (event === 'MarkerTweaked') {
          const rows = ids.flatMap(id => (index.get(id) ? [index.get(id)!] : []))
          if (rows.length) {
            const uid = rows[0].updaterId
            appEvent.emit(event, rows, Object.assign({ id: uid }, users[uid!]))
          }
        } else {
          const row = index.get(ids[0])
          if (row) {
            const uid = event === 'MarkerAdded' ? row.creatorId : row.updaterId
            appEvent.emit(event, row, Object.assign({ id: uid }, users[uid!]))
          }
        }
      }
    },
  )
  const itemEvents = batchSocketEvents(
    item.update,
    (session, event: { event: 'ItemAdded' | 'ItemUpdated'; id: number }) =>
      sync.invalidate(session, 'item', [event.id]),
    async (session, events) => {
      const { items, users } = await item.readItems(session, [...new Set(events.map(e => e.id))])
      if (!sync.isCurrent(session)) return
      const index = new Map(items.map(row => [row.id, row]))
      for (const { event, id } of events) {
        const row = index.get(id)
        if (row) {
          const uid = event === 'ItemAdded' ? row.creatorId : row.updaterId
          appEvent.emit(event, row, Object.assign({ id: uid }, users[uid!]))
        }
      }
    },
  )

  const linkEvents = batchSocketEvents(
    link.update,
    (session, event: WebSocketAPI.WSMarkerLinkData) => link.trackLinkChange(session, event),
    async (session, events) => {
      const change = {
        groups: [...new Set(events.flatMap(event => event.groups))],
        markers: [...new Set(events.flatMap(event => event.markers))],
      }
      const { markers, user } = await link.readLinkChange(session, change)
      if (!sync.isCurrent(session)) return
      appEvent.emit('MarkerLinked', markers, user)
    },
  )

  const deleteEntity = (resource: 'marker' | 'item', id: number) => {
    if (!isEntityId(id)) return
    withSocketScope(
      async session => {
        const previous = sync.projection.entities[resource].get(id)
        // 删除先按原始消息 ID 事务落库。历史查询仅补通知文案。
        await sync.remove(session, resource, [id])
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
        if (!sync.isCurrent(session)) return
        const entry = history?.data?.record?.[0]
        let details = previous
        if (entry?.content) {
          try {
            details = JSON.parse(entry.content) ?? previous
          } catch {
            /* 文案退回本地实体 */
          }
        }
        const uid = entry?.creatorId
        const user = Object.assign({ id: uid }, history?.users?.[uid ?? 0])
        if (resource === 'marker')
          appEvent.emit('MarkerDeleted', { ...details, id } as MarkerVo, user)
        else appEvent.emit('ItemDeleted', { ...details, id } as ItemVo, user)
      },
      resource === 'marker' ? marker.update : item.update,
    )
  }

  ipc.on('MarkerAdded', id => {
    if (isEntityId(id)) markerEvents({ event: 'MarkerAdded', ids: [id] })
  })
  ipc.on('MarkerUpdated', id => {
    if (isEntityId(id)) markerEvents({ event: 'MarkerUpdated', ids: [id] })
  })
  ipc.on('MarkerTweaked', ids => {
    if (Array.isArray(ids)) markerEvents({ event: 'MarkerTweaked', ids: ids.filter(isEntityId) })
  })
  ipc.on('MarkerDeleted', id => deleteEntity('marker', id))
  ipc.on('ItemAdded', id => {
    if (isEntityId(id)) itemEvents({ event: 'ItemAdded', id })
  })
  ipc.on('ItemUpdated', id => {
    if (isEntityId(id)) itemEvents({ event: 'ItemUpdated', id })
  })
  ipc.on('ItemDeleted', id => deleteEntity('item', id))
  ipc.on('MarkerLinked', payload => {
    if (!payload || !Array.isArray(payload.groups) || !Array.isArray(payload.markers)) {
      if (sync.scope && socket.hasCurrentCredentials) void link.update()
      return
    }
    linkEvents({
      groups: payload.groups.filter(group => typeof group === 'string' && group.length > 0),
      markers: payload.markers.filter(isEntityId),
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
