import type { MarkerLinkageVo } from '@/api/alova/globals'
import type { MapEntitySync } from './mapEntitySync'
import type { MarkerWithUsers } from './utils/fetchMarkersByIds'
import { acceptHMRUpdate, defineStore } from 'pinia'
import Apis from '@/api/alova'
import { useMapEntitySync } from './mapEntitySync'
import { stageArchive } from './mapEntitySync/archives'
import { isEntityId } from './mapEntitySync/model'
import { checkDetails, fetchLinkGroups } from './mapEntitySync/sources'
import { useEntityManager } from './mapEntitySync/useEntityManager'
import { fetchMarkersWithUsersByIds } from './utils/fetchMarkersByIds'

interface LinkChange {
  groups: string[]
  markers: number[]
  deleted?: number[]
}

const endpoints = (links: Iterable<MarkerLinkageVo>) => {
  const result = new Set<number>()
  for (const { fromId, toId } of links) {
    if (isEntityId(fromId)) result.add(fromId)
    if (isEntityId(toId)) result.add(toId)
  }
  return result
}

export const useMarkerLinkStore = defineStore('global-marker-link', () => {
  const sync = useMapEntitySync()
  type Session = ReturnType<MapEntitySync['current']>
  const empty = new Map<number, MarkerLinkageVo>()
  const idMap = computed(() =>
    sync.projection.state.resources.markerLink?.baseline
      ? sync.projection.entities.markerLink
      : empty,
  )
  const markerLinkList = computed(() => [...idMap.value.values()])
  const total = computed(() => markerLinkList.value.length)
  const updateVersion = computed(() => sync.projection.revisions.markerLink)
  const groupIdMap = computed(() => {
    const groups = new Map<string, MarkerLinkageVo[]>()
    for (const link of markerLinkList.value) {
      const group = groups.get(link.groupId!)
      if (group) group.push(link)
      else groups.set(link.groupId!, [link])
    }
    return groups
  })

  const createBatch = async (session: Session, change?: LinkChange) => {
    const { state, entities } = await sync.refresh(session)
    const groups = new Set(change?.groups.filter(Boolean))
    for (const id of change?.markers ?? []) {
      const group = entities.marker.get(id)?.linkageId
      if (group) groups.add(group)
    }
    for (const id of change?.deleted ?? []) {
      const group = entities.markerLink.get(id)?.groupId
      if (group) groups.add(group)
    }
    const full = !groups.size
    const updates = await fetchLinkGroups(full ? undefined : [...groups])
    const notifiedIds = new Set(change?.markers)
    const details: MarkerWithUsers = { markers: [], users: {} }
    const resolvedIds = new Set<number>()
    const edgesBefore = [...entities.markerLink.values()]
    let oldEdges = edgesBefore.filter(link => full || groups.has(link.groupId!))
    if (change || state.resources.markerLink?.baseline) {
      for (let round = 0; ; round++) {
        const expected = new Map<number, string>()
        for (const link of updates) {
          expected.set(link.fromId!, link.groupId!)
          expected.set(link.toId!, link.groupId!)
        }
        const affected = new Set([...endpoints(oldEdges), ...endpoints(updates), ...notifiedIds])
        const ids = [...affected].filter(id => {
          if (resolvedIds.has(id)) return false
          const marker = entities.marker.get(id)
          return marker
            ? (marker.linkageId || undefined) !== expected.get(id)
            : notifiedIds.has(id) && !state.resources.marker?.baseline
        })
        const read = await fetchMarkersWithUsersByIds(ids)
        if (checkDetails(read.markers, ids).length) throw new Error('关联端点尚待核对')
        for (const id of ids) resolvedIds.add(id)
        details.markers.push(...read.markers)
        Object.assign(details.users, read.users)
        const extra = [
          ...new Set(
            read.markers.flatMap(({ linkageId }) =>
              linkageId && !groups.has(linkageId) ? [linkageId] : [],
            ),
          ),
        ]
        if (full || !extra.length) {
          if (
            details.markers.some(
              marker => (marker.linkageId || undefined) !== expected.get(marker.id!),
            )
          )
            throw new Error('关联组与点位详情尚未一致')
          break
        }
        if (round >= 3) throw new Error('关联组持续变化，等待整表核对')
        for (const group of extra) groups.add(group)
        updates.push(...(await fetchLinkGroups(extra)))
        oldEdges = edgesBefore.filter(link => groups.has(link.groupId!))
      }
    }
    const newIds = new Set(updates.map(({ id }) => id!))
    const pendingDeletes = state.resources.markerLink?.pendingDeletes ?? []
    const confirmedDeletes = new Set([
      ...(change?.deleted ?? []),
      ...pendingDeletes.filter(
        id => full || groups.has(entities.markerLink.get(id)?.groupId ?? ''),
      ),
    ])
    if ([...confirmedDeletes].some(id => newIds.has(id)))
      throw new Error('关联回读仍包含已删除的边')
    const deletes = oldEdges.flatMap(({ id }) => (newIds.has(id!) ? [] : [id!]))
    return {
      input: {
        revision: state.revision,
        atomic: true,
        batches: {
          markerLink: {
            updates,
            deletes,
            confirmedDeleteIds: [...confirmedDeletes],
            state: full
              ? { baseline: true, checkedAt: Date.now(), pendingRanges: [], pendingDeletes: [] }
              : {
                  pendingRanges:
                    state.resources.markerLink?.pendingRanges?.filter(group => !groups.has(group))
                    ?? [],
                  pendingDeletes: pendingDeletes.filter(id => !confirmedDeletes.has(id)),
                },
          },
          marker: { updates: details.markers },
        },
      },
      details,
      notified: [...notifiedIds],
      updaterId: updates[0]?.updaterId,
    }
  }

  const manager = useEntityManager(sync, 'markerLink', async (session, full) => {
    const { state, pending } = await sync.refresh(session)
    const resource = state.resources.markerLink
    if (
      !full
      && !resource?.pendingRanges?.length
      && !resource?.pendingDeletes?.length
      && !pending.markerLink.size
    ) {
      const stage = await stageArchive(sync, session, 'markerLink', resource).catch(() => undefined)
      if (stage?.unchanged && resource?.baseline) return { input: { batches: {} } }
      if (stage?.entities)
        return {
          input: {
            revision: state.revision,
            atomic: true,
            batches: {
              markerLink: {
                updates: stage.entities,
                deletes: stage.removed,
                archive: true,
                state: { ...stage.state, baseline: true },
              },
            },
          },
        }
    }
    return createBatch(session)
  })

  const readLinkChange = async (session: Session, change: LinkChange) => {
    const { input, details, notified, updaterId } = await createBatch(session, change)
    const { conflict } = await sync.commit(session, input)
    if (conflict) throw new Error('关联组在回读期间发生变化')
    sync.assertCurrent(session)
    const markerMap = sync.projection.entities.marker
    return {
      markers: notified.flatMap(id => (markerMap.get(id) ? [markerMap.get(id)!] : [])),
      user: updaterId ? { id: updaterId, ...details.users[updaterId] } : {},
    }
  }

  const trackLinkChange = async (session: Session, change: LinkChange) => {
    const { entities } = await sync.refresh(session)
    const groups = new Set(change.groups)
    for (const id of change.markers) {
      const group = entities.marker.get(id)?.linkageId
      if (group) groups.add(group)
    }
    const edges = [...entities.markerLink.values()].filter(link => groups.has(link.groupId!))
    const markers = new Set([...change.markers, ...endpoints(edges)])
    await sync.commit(session, {
      batches: {
        markerLink: {
          invalidations: [...new Set([...edges.map(({ id }) => id!), ...(change.deleted ?? [])])],
          markRanges: groups.size ? [...groups] : ['*'],
          markDeletes: change.deleted,
        },
        marker: { invalidations: [...markers] },
      },
    })
  }

  const afterMutation = (session: Session, change: LinkChange) => {
    void trackLinkChange(session, change)
      .then(() => sync.enqueue(session, () => readLinkChange(session, change)))
      .catch(cause => {
        sync.reportError(session, cause)
        if (sync.isCurrent(session)) void manager.update()
      })
  }

  const linkMarker = async (links: MarkerLinkageVo[], deleteLinks: MarkerLinkageVo[] = []) => {
    if (!links.length) throw new Error('提交的关联项为空')
    const session = sync.current()
    const affected = [...links, ...deleteLinks]
    const markers = [...endpoints(affected)]
    const groups = new Set(affected.flatMap(link => (link.groupId ? [link.groupId] : [])))
    for (const id of markers) {
      const group = sync.projection.entities.marker.get(id)?.linkageId
      if (group) groups.add(group)
    }
    const { data: group } = await Apis.marker_link.linkMarker({
      data: links.map(({ fromId, toId, linkAction, path }) => ({ fromId, toId, linkAction, path })),
    })
    if (!group) throw new Error('服务器未返回新关联组 ID')
    groups.add(group)
    afterMutation(session, { groups: [...groups], markers })
    return group
  }

  const deleteMarkerLinkage = async (ids: number[]) => {
    if (!ids.length) throw new Error('删除的关联 ID 列表为空')
    const session = sync.current()
    const oldEdges = ids.flatMap(id => (idMap.value.get(id) ? [idMap.value.get(id)!] : []))
    const { data } = await Apis.marker_link.deleteMarkerLinkage({ data: { ids } })
    if (!data) throw new Error('服务器未返回删除结果')
    const groups = [
      ...new Set([
        ...(data.groups ?? []),
        ...oldEdges.flatMap(link => (link.groupId ? [link.groupId] : [])),
      ]),
    ]
    const markers = [...new Set([...(data.markers ?? []), ...endpoints(oldEdges)])]
    afterMutation(session, { groups, markers, deleted: ids })
    return data
  }

  return {
    ...manager,
    idMap,
    markerLinkList,
    total,
    updateVersion,
    groupIdMap,
    linkMarker,
    deleteMarkerLinkage,
    readLinkChange,
    trackLinkChange,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMarkerLinkStore, import.meta.hot))
}
