import type { MarkerVo } from '@/api/alova/globals'

/** 服务端下发的比对快照条目 */
export interface MarkerSnapshot {
  id?: number
  version?: number
  linkageId?: string
}

/** 快照中 `linkageId` 发生变化、需要就地修正的本地点位 */
export interface MarkerLinkagePatch {
  id: number
  linkageId?: string
}

export interface MarkerDiffResult {
  /** 本地缺失或版本落后，需要回源拉取完整数据的点位 */
  fetchIds: number[]
  /** 仅 `linkageId` 发生变化，可以直接就地修正的点位 */
  patches: MarkerLinkagePatch[]
  /** 快照中已不存在，需要从本地移除的点位 */
  deleteIds: number[]
  /** 快照中的点位总数 */
  total: number
}

/**
 * 比对服务端快照与本地数据
 *
 * - 本地缺失 / 版本落后 → 回源查询
 * - 版本一致但 `linkageId` 不同 → 点位关联变更不会提升 version，快照中的 `linkageId` 即权威值，
 *   直接就地修正即可，无需为了一次关联变更把整批点位重新拉一遍
 * - 快照中不存在 → 从本地移除
 *
 * @param snapshots 服务端快照
 * @param markerMap 本地点位索引表
 * @param ownedIds 发起快照请求前的本地点位 id，用于避免误删请求期间新增的点位
 */
export const diffMarkers = async (
  snapshots: MarkerSnapshot[],
  markerMap: Map<number, MarkerVo>,
  ownedIds: Set<number>,
): Promise<MarkerDiffResult> => {
  const fetchIds = new Set<number>()
  const patches: MarkerLinkagePatch[] = []
  const deleteIds = new Set(ownedIds)
  const { length } = snapshots
  for (let i = 0; i < length; i++) {
    if (i && i % 2000 === 0) await scheduler.yield() // 每 2000 个点位等一次，避免卡顿
    const { id, version: rawVersion, linkageId } = snapshots[i]
    // id 缺失的快照没有比对价值；version 可能为 0，不能用假值判断
    if (id === undefined) continue
    deleteIds.delete(id)
    const localMarker = markerMap.get(id)
    if (!localMarker) {
      fetchIds.add(id)
      continue
    }
    const version = rawVersion ?? 0
    const localVersion = localMarker.version ?? 0
    if (version > localVersion) {
      fetchIds.add(id)
      continue
    }
    // 本地数据比快照新（例如刚写入的乐观更新），保留本地
    if (version < localVersion) continue
    if ((linkageId ?? '') === (localMarker.linkageId ?? '')) continue
    patches.push({ id, linkageId })
  }
  return { fetchIds: [...fetchIds], patches, deleteIds: [...deleteIds], total: length }
}
