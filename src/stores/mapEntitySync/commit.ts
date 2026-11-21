import type { CommitInput, EntityRow, MapResource, ScopeState } from './model'
import { acceptEntity, isEntityId, mapResources, sameEntity, validateEntities } from './model'

export function batchIds(batch: NonNullable<CommitInput['batches'][MapResource]>) {
  return new Set([
    ...validateEntities(batch.updates ?? []),
    ...(batch.deletes ?? []),
    ...(batch.confirmedDeleteIds ?? []),
    ...(batch.invalidations ?? []),
  ])
}

export function planCommit(
  previous: ScopeState,
  input: CommitInput,
  rowsByResource: ReadonlyMap<MapResource, ReadonlyMap<number, EntityRow>>,
) {
  const revision = previous.revision + 1
  const resources = { ...previous.resources }
  const rows: EntityRow[] = []
  const counts = { updated: 0, deleted: 0 }
  let conflict = false
  let changed = false

  for (const resource of mapResources) {
    const batch = input.batches[resource]
    if (!batch) continue
    const existing = rowsByResource.get(resource)
    const updates = new Map((batch.updates ?? []).map(entity => [entity.id!, entity]))
    const confirmedDeletes = new Set(batch.confirmedDeleteIds)
    const deletes = new Set([...(batch.deletes ?? []), ...confirmedDeletes])
    const invalidations = new Set(batch.invalidations)
    const previousResource = resources[resource]
    if (input.revision !== undefined && (previousResource?.invalidatedAt ?? 0) > input.revision) {
      conflict = true
      continue
    }
    let resourceConflict = false

    for (const id of batchIds(batch)) {
      if (!isEntityId(id)) throw new Error('提交含无效实体 ID')
      const row = existing?.get(id)
      if (
        batch.archive
        && (row?.pending || row?.deleted || row?.removedOnline || (row?.entity && !row.fromArchive))
      )
        continue
      if (batch.archive && !row?.entity && previousResource?.checkedAt) continue
      if (input.revision !== undefined && (row?.revision ?? 0) > input.revision) {
        resourceConflict = true
        continue
      }
      const key = { scope: previous.scope, resource, id, revision }
      if (deletes.has(id)) {
        const confirmed = batch.confirmedDeletes || confirmedDeletes.has(id)
        if (row?.deleted || (!row?.entity && !row?.pending && !confirmed)) continue
        rows.push({
          ...key,
          deleted: confirmed ? true : undefined,
          removedOnline: !batch.archive ? true : undefined,
        })
        if (row?.entity) counts.deleted++
        continue
      }
      if (invalidations.has(id)) {
        if (!row?.deleted) rows.push({ ...row, ...key, pending: true })
        continue
      }
      const incoming = updates.get(id)!
      if (!acceptEntity(row, incoming, input.revision)) {
        resourceConflict ||= !row?.deleted
        continue
      }
      const same = sameEntity(row?.entity, incoming)
      if (!same) counts.updated++
      if (!same || row?.pending || (!batch.archive && row?.fromArchive))
        rows.push({ ...key, entity: incoming, fromArchive: batch.archive ? true : undefined })
    }
    conflict ||= resourceConflict
    if ((batch.state || batch.markRanges) && !resourceConflict) {
      resources[resource] = { baseline: false, checkedAt: 0, ...previousResource, ...batch.state }
      if (batch.markRanges) {
        resources[resource].pendingRanges = [
          ...new Set([...(previousResource?.pendingRanges ?? []), ...batch.markRanges]),
        ]
        resources[resource].invalidatedAt = revision
      }
      if (batch.markDeletes) {
        resources[resource].pendingDeletes = [
          ...new Set([...(previousResource?.pendingDeletes ?? []), ...batch.markDeletes]),
        ]
      }
      changed = true
    }
  }

  if (input.atomic && conflict)
    return { state: previous, rows: [], counts: { updated: 0, deleted: 0 }, conflict }
  const state = rows.length || changed ? { ...previous, resources, revision } : previous
  return { state, rows, counts, conflict }
}
