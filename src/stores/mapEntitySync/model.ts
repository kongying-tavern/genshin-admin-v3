import type { ItemVo, MarkerLinkageVo, MarkerVo } from '@/api/alova/globals'

export interface MapEntities {
  marker: MarkerVo
  item: ItemVo
  markerLink: MarkerLinkageVo
}

export type MapResource = keyof MapEntities
export const mapResources: MapResource[] = ['item', 'marker', 'markerLink']

export interface EntityRow {
  scope: string
  resource: MapResource
  id: number
  revision: number
  entity?: MapEntities[MapResource]
  deleted?: true
  pending?: true
  fromArchive?: true
  removedOnline?: true
}

export interface ResourceState {
  baseline: boolean
  checkedAt: number
  archiveTime?: number
  archiveKey?: string
  archivePages?: string[]
  rejectedArchiveKey?: string
  pendingRanges?: string[]
  pendingDeletes?: number[]
  invalidatedAt?: number
}

export interface ArchivePage {
  scope: string
  resource: MapResource
  format: number
  digest: string
  ids: number[]
  entities: MapEntities[MapResource][]
}

export interface ScopeState {
  scope: string
  revision: number
  resources: Partial<Record<MapResource, ResourceState>>
}

export interface MarkerCommand {
  scope: string
  key: string
  mutationId: string
  status: 'sending' | 'unknown' | 'accepted'
  createdAt: number
  draft: MarkerVo
  markerId?: number
}

export interface EntityBatch {
  updates?: readonly MapEntities[MapResource][]
  deletes?: readonly number[]
  invalidations?: readonly number[]
  /** 直接删除回执使用墓碑。完整查询缺失只清除当前可见投影。 */
  confirmedDeletes?: boolean
  confirmedDeleteIds?: readonly number[]
  archive?: boolean
  markRanges?: string[]
  markDeletes?: number[]
  state?: Partial<ResourceState>
}

export interface CommitInput {
  revision?: number
  atomic?: boolean
  batches: Partial<Record<MapResource, EntityBatch>>
}

export const isEntityId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

export const validateEntities = <T extends { id?: number }>(entities: readonly T[]) => {
  const ids = new Set<number>()
  for (const { id } of entities) {
    if (!isEntityId(id) || ids.has(id)) throw new Error('实体列表含无效或重复的 ID')
    ids.add(id)
  }
  return ids
}

export const acceptEntity = (
  previous: EntityRow | undefined,
  incoming: MapEntities[MapResource],
  revision: number | undefined,
) =>
  !previous?.deleted
  && (revision === undefined || (previous?.revision ?? 0) <= revision)
  && Number.isSafeInteger(incoming.version ?? 0)
  && (incoming.version ?? 0) >= 0
  && (incoming.version ?? 0) >= (previous?.entity?.version ?? 0)

export function sameEntity(
  previous: MapEntities[MapResource] | undefined,
  incoming: MapEntities[MapResource],
) {
  if (!previous || previous.version !== incoming.version) return false
  // 部分关联操作不会提升点位版本，部分后端也会返回版本为 0 的边。
  return jsonKey(previous) === jsonKey(incoming)
}

export function jsonKey(value: unknown) {
  return JSON.stringify(value, (_key, nested: unknown) =>
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b)))
      : nested,
  )
}
