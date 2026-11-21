import type { ItemVo, MarkerLinkageVo, MarkerVo } from '@/api/alova/globals'
import type { ManagerTask } from '../hooks'
import Apis from '@/api/alova'
import { diffMarkers } from '../utils/diffMarkers'
import { fetchMarkersByIds } from '../utils/fetchMarkersByIds'
import { isEntityId, jsonKey, validateEntities } from './model'

export function checkDetails<T extends { id?: number }>(rows: T[], ids: number[]) {
  const expected = new Set(ids)
  const actual = validateEntities(rows)
  if (!actual.isSubsetOf(expected)) throw new Error('详情接口返回了未请求的实体')
  return [...expected.difference(actual)]
}

export async function verifyMarkerArchive(markers: MarkerVo[]) {
  if (!markers.length) return true
  const sampleSize = Math.min(markers.length, 40)
  const sample = new Map<number, MarkerVo>(
    Array.from({ length: sampleSize }, (_, index) => {
      const row = markers[Math.floor((index * markers.length) / sampleSize)]
      return [row.id!, row]
    }),
  )
  const ids = [...sample.keys()]
  const details = await fetchMarkersByIds(ids)
  if (checkDetails(details, ids).length) return false
  let verified = 0
  for (const detail of details) {
    const archived = sample.get(detail.id!)!
    // 在线版本较新的记录由差异路径回读。
    if ((detail.version ?? 0) > (archived.version ?? 0)) continue
    if (detail.version !== archived.version || !sameMarkerRenderFields(archived, detail))
      return false
    verified++
  }
  return verified > 0
}

export function sameMarkerRenderFields(a: MarkerVo, b: MarkerVo) {
  const signature = (row: MarkerVo) => [
    row.position,
    row.hiddenFlag ?? 0,
    row.itemList?.map(({ itemId, iconId, count }) => [itemId, iconId, count]) ?? [],
    row.extra?.underground ?? {},
    row.extra?.iconOverride ?? {},
  ]
  return jsonKey(signature(a)) === jsonKey(signature(b))
}

/** 全包的内容以在线索引为准，补齐较新版本及发布后的变化。 */
export async function fetchMarkerReconciliation(
  local: Map<number, MarkerVo>,
  pending: ReadonlySet<number>,
  useArchive: boolean,
  task: ManagerTask,
  loadPages: (detailBatches?: number) => Promise<MarkerVo[] | undefined>,
) {
  let archive = useArchive
    ? ((await loadPages()) ?? (await Apis.marker_doc.listMarkersByBinary().catch(() => undefined)))
    : undefined
  const { snapshots } = await Apis.marker_doc.listMarkerDiffSnapshotByBinary()
  if (!Array.isArray(snapshots)) throw new Error('点位快照响应异常')
  const snapshotIds = validateEntities(snapshots)
  if (snapshots.some(({ version }) => !Number.isSafeInteger(version) || version < 0))
    throw new Error('点位快照包含非法版本')
  if (!useArchive) {
    const detailCount = snapshots.reduce(
      (count, { id, version }) =>
        count + Number(!local.has(id) || version > (local.get(id)?.version ?? 0)),
      0,
    )
    archive = await loadPages(Math.max(1, Math.ceil(detailCount / 100)))
  }
  const validArchive =
    archive
    && (() => {
      try {
        validateEntities(archive)
        return new Map(archive.map(row => [row.id!, row]))
      } catch {
        return undefined
      }
    })()
  const baseline = new Map(local)
  const changed = new Map<number, MarkerVo>()
  for (const snapshot of snapshots) {
    const id = snapshot.id
    const archived = validArchive?.get(id)
    if (
      !archived
      || archived.version !== snapshot.version
      || (local.get(id)?.version ?? -1) >= archived.version
    )
      continue
    if (!archived.position || !Array.isArray(archived.itemList)) continue
    const marker = { ...archived, linkageId: snapshot.linkageId }
    baseline.set(id, marker)
    changed.set(id, marker)
  }
  const { fetchIds, patches } = await diffMarkers(snapshots, baseline, new Set(local.keys()))
  for (const { id, linkageId } of patches) changed.set(id, { ...baseline.get(id), linkageId })
  const detailIds = [...new Set([...fetchIds, ...pending.intersection(snapshotIds)])]
  task.report(0.3)
  const details = await fetchMarkersByIds(detailIds, {
    onProgress: (loaded, total) => task.report({ loaded, total }, { from: 0.3, to: 0.95 }),
  })
  const missing = checkDetails(details, detailIds)
  const versions = new Map(snapshots.map(({ id, version }) => [id, version]))
  for (const detail of details) {
    if ((detail.version ?? 0) < (versions.get(detail.id!) ?? 0)) missing.push(detail.id!)
    else changed.set(detail.id!, detail)
  }
  for (const id of missing) changed.delete(id)
  return {
    updates: [...changed.values()],
    deletes: [...new Set([...local.keys(), ...pending]).difference(snapshotIds)],
    missing,
  }
}

const ITEM_PAGE_SIZE = 500

export async function readItemArea(
  areaId: number,
  readPage: (
    areaId: number,
    current: number,
  ) => Promise<{ record?: ItemVo[]; total?: number } | undefined>,
) {
  const result = new Map<number, ItemVo>()
  let total = 0
  for (let current = 1; current === 1 || result.size < total; current++) {
    const data = await readPage(areaId, current)
    const { record, total: reportedTotal } = data ?? {}
    if (
      !Array.isArray(record)
      || typeof reportedTotal !== 'number'
      || !Number.isSafeInteger(reportedTotal)
      || reportedTotal < 0
      || (current !== 1 && reportedTotal !== total)
    )
      throw new Error('物品分页的总数或记录异常')
    total = reportedTotal
    if (record.length === 0 && result.size < total) throw new Error('物品分页提前结束')
    for (const row of record) {
      if (!isEntityId(row.id) || result.has(row.id) || row.areaId !== areaId)
        throw new Error('物品分页包含重复或归属不符的记录')
      result.set(row.id, row)
    }
    if (result.size > total) throw new Error('物品分页超过总数')
  }
  return [...result.values()]
}

export async function fetchItemAreas(task: ManagerTask) {
  const { data } = await Apis.area.listArea({ data: { isTraverse: true } })
  if (!Array.isArray(data)) throw new Error('地区列表响应异常')
  validateEntities(data)
  const areaIds = data.filter(area => area.parentId !== -1).map(area => area.id!)
  const items = new Map<number, ItemVo>()
  const failed = new Set<number>()
  const ambiguous = new Set<number>()
  let cursor = 0
  let finished = 0
  const worker = async () => {
    while (cursor < areaIds.length) {
      const areaId = areaIds[cursor++]
      try {
        const rows = await readItemArea(areaId, async (id, current) => {
          const { data } = await Apis.item.listItemIdByType({
            data: { areaIdList: [id], current, size: ITEM_PAGE_SIZE, sort: ['id+'] },
          })
          return data
        })
        for (const row of rows) {
          const id = row.id!
          if (ambiguous.has(id)) {
            failed.add(areaId)
            continue
          }
          const previous = items.get(id)
          if (previous) {
            failed.add(previous.areaId!)
            failed.add(areaId)
            items.delete(id)
            ambiguous.add(id)
          } else {
            items.set(id, row)
          }
        }
      } catch {
        failed.add(areaId)
      } finally {
        task.report({ loaded: ++finished, total: areaIds.length })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(areaIds.length, 4) }, worker))
  return { items, failed }
}

export async function fetchLinkGroups(groups?: string[]) {
  const { data } = await Apis.marker_link.getMarkerLinkageList({
    data: groups?.length ? { groupIds: groups } : { isTraverse: true },
  })
  return decodeLinkGroups(data, groups)
}

export function decodeLinkGroups(data: unknown, groups?: string[]) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('关联列表响应异常')
  const result: MarkerLinkageVo[] = []
  for (const [group, links] of Object.entries(data)) {
    if (
      !group
      || (groups?.length && !groups.includes(group))
      || !Array.isArray(links)
      || links.some(
        link => link.groupId !== group || !isEntityId(link.fromId) || !isEntityId(link.toId),
      )
    )
      throw new Error('关联列表包含不完整的组或端点')
    for (const link of links) result.push(link)
  }
  validateEntities(result)
  return result
}
