import type { CommitInput, EntityRow, MapEntities, MapResource, ScopeState } from './model'
import { liveQuery } from 'dexie'
import { defineStore } from 'pinia'
import db from '@/database'
import { messageFrom } from '@/utils/messageFrom'
import { useAccessStore } from '../access'
import { useUserStore } from '../user'
import { batchIds, planCommit } from './commit'
import { mapResources } from './model'

const createProjection = (scope = '') => ({
  state: { scope, revision: 0, resources: {} } as ScopeState,
  entities: {
    marker: new Map<number, MapEntities['marker']>(),
    item: new Map<number, MapEntities['item']>(),
    markerLink: new Map<number, MapEntities['markerLink']>(),
  },
  pending: { marker: new Set<number>(), item: new Set<number>(), markerLink: new Set<number>() },
  deletedMarkerIds: new Set<number>(),
  revisions: { marker: 0, item: 0, markerLink: 0 },
})

interface SyncSession {
  scope: string
  tail: Promise<unknown>
}

export const useMapEntitySync = defineStore('map-entity-sync', () => {
  const user = useUserStore()
  const access = useAccessStore()
  const projection = shallowRef(createProjection())
  const error = ref('')
  const online = useOnline()
  const scope = computed(() => {
    const { info, auth } = user
    if (!auth.accessToken || !info?.id || auth.userId !== info.id || !info.role?.code) return ''
    return JSON.stringify([
      // 包括开发代理指向的实例，避免切换代理后复用同源缓存。
      import.meta.env.VITE_API_BASE,
      import.meta.env.DEV ? import.meta.env.VITE_API_PROXY_TARGET : '',
      info.id,
      info.roleId,
      info.role.code,
      access.userHiddenFlagMask,
    ])
  })
  let session: SyncSession | undefined

  const isCurrent = (expected: SyncSession) => session === expected
  const assertCurrent = (expected: SyncSession) => {
    if (!isCurrent(expected)) throw new Error('地图数据作用域已切换')
  }
  const current = () => {
    if (!session) throw new Error('地图数据作用域尚未就绪')
    return session
  }
  const reportError = (expected: SyncSession, cause: unknown) => {
    if (isCurrent(expected)) error.value = messageFrom(cause)
  }

  function publish(expected: SyncSession, state: ScopeState, rows: EntityRow[]) {
    if (!isCurrent(expected) || state.revision <= projection.value.state.revision) return
    const next = { ...projection.value, state }
    const revisions = { ...next.revisions }
    const entities = { ...next.entities }
    const pending = { ...next.pending }
    let deletedMarkerIds = next.deletedMarkerIds
    const updatedResources = new Set<MapResource>()
    const pendingResources = new Set<MapResource>()
    for (const { resource, id, entity, deleted, pending: needsCheck } of rows) {
      if (resource === 'marker' && deleted) {
        if (deletedMarkerIds === next.deletedMarkerIds) deletedMarkerIds = new Set(deletedMarkerIds)
        deletedMarkerIds.add(id)
      }
      if (entities[resource].get(id) !== entity) {
        if (!updatedResources.has(resource)) {
          Object.assign(entities, {
            [resource]: new Map<number, MapEntities[MapResource]>(entities[resource]),
          })
          revisions[resource]++
          updatedResources.add(resource)
        }
        if (entity) (entities[resource] as Map<number, MapEntities[MapResource]>).set(id, entity)
        else entities[resource].delete(id)
      }
      if (needsCheck === true ? !pending[resource].has(id) : pending[resource].has(id)) {
        if (!pendingResources.has(resource)) {
          pending[resource] = new Set(pending[resource])
          pendingResources.add(resource)
        }
        if (needsCheck) pending[resource].add(id)
        else pending[resource].delete(id)
      }
    }
    for (const resource of mapResources) {
      if (
        !updatedResources.has(resource)
        && state.resources[resource]?.baseline
          !== projection.value.state.resources[resource]?.baseline
      )
        revisions[resource]++
    }
    projection.value = { ...next, entities, pending, revisions, deletedMarkerIds }
  }

  const refresh = async (expected: SyncSession) => {
    assertCurrent(expected)
    const knownRevision = projection.value.state.revision
    const result = await db.transaction('r', [db.mapEntityState, db.mapEntity], async () => {
      const state = await db.mapEntityState.get(expected.scope)
      if (!state || knownRevision >= state.revision) return
      const rows = await db.mapEntity
        .where('[scope+revision]')
        .between([expected.scope, knownRevision], [expected.scope, state.revision], false, true)
        .toArray()
      return { state, rows }
    })
    if (result) publish(expected, result.state, result.rows)
    assertCurrent(expected)
    return projection.value
  }

  watch(
    scope,
    (key, _, onCleanup) => {
      session = key ? { scope: key, tail: Promise.resolve() } : undefined
      projection.value = createProjection(key)
      error.value = ''
      const expected = session
      if (!expected) return
      // Dexie liveQuery 会广播已提交的 IndexedDB 事务，其他标签页按修订号补读。
      const subscription = liveQuery(() =>
        db.mapEntityState.get(key).then(state => state?.revision),
      ).subscribe({
        next: () => {
          void refresh(expected).catch(cause => reportError(expected, cause))
        },
        error: cause => reportError(expected, cause),
      })
      onCleanup(() => subscription.unsubscribe())
    },
    { immediate: true, flush: 'sync' },
  )

  const commit = async (expected: SyncSession, input: CommitInput) => {
    const write = () =>
      db.transaction('rw', [db.mapEntityState, db.mapEntity], async () => {
        assertCurrent(expected)
        const previous = (await db.mapEntityState.get(expected.scope)) ?? {
          scope: expected.scope,
          revision: 0,
          resources: {},
        }
        const rowsByResource = new Map<MapResource, Map<number, EntityRow>>()
        for (const resource of mapResources) {
          const batch = input.batches[resource]
          if (!batch) continue
          const keys = Array.from(batchIds(batch), (id): [string, MapResource, number] => [
            expected.scope,
            resource,
            id,
          ])
          const rows = await db.mapEntity.bulkGet(keys)
          rowsByResource.set(resource, new Map(rows.flatMap(row => (row ? [[row.id, row]] : []))))
        }
        const planned = planCommit(previous, input, rowsByResource)
        assertCurrent(expected)
        if (planned.rows.length) await db.mapEntity.bulkPut(planned.rows)
        if (planned.state !== previous) await db.mapEntityState.put(planned.state)
        assertCurrent(expected)
        return planned
      })
    try {
      assertCurrent(expected)
      // Web Locks 选出当前提交者。无此 API 时由跨标签页互斥的读写事务执行同样的检查。
      const result = navigator.locks
        ? await navigator.locks.request(`map-entity:${expected.scope}`, write)
        : await write()
      if (isCurrent(expected)) {
        if (result.state.revision === projection.value.state.revision + 1)
          publish(expected, result.state, result.rows)
        else await refresh(expected)
        error.value = ''
      }
      return result
    } catch (cause) {
      reportError(expected, cause)
      throw cause
    }
  }

  /** 网络对账按作用域排队，删除和失效登记可在网络请求期间直接提交。 */
  function enqueue<T>(expected: SyncSession, work: () => Promise<T>) {
    const execute = () => {
      assertCurrent(expected)
      return work()
    }
    const next = expected.tail.then(() =>
      navigator.locks
        ? navigator.locks.request(`map-reconcile:${expected.scope}`, execute)
        : execute(),
    )
    expected.tail = next.catch(cause => reportError(expected, cause))
    return next
  }

  function invalidate(expected: SyncSession, resource: MapResource, ids: number[]) {
    return commit(expected, { batches: { [resource]: { invalidations: ids } } })
  }

  function remove(expected: SyncSession, resource: MapResource, ids: number[]) {
    return commit(expected, { batches: { [resource]: { deletes: ids, confirmedDeletes: true } } })
  }

  return {
    scope,
    projection,
    online,
    error,
    current,
    isCurrent,
    assertCurrent,
    refresh,
    commit,
    enqueue,
    invalidate,
    remove,
    reportError,
  }
})

export type MapEntitySync = ReturnType<typeof useMapEntitySync>
