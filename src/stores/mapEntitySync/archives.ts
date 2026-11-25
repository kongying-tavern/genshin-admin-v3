import type { BinaryDownloadListener } from '@/api/alova/binaryDownload'
import type { BinaryMD5Vo, ItemVo, MarkerVo } from '@/api/alova/globals'
import type { MapEntitySync } from './index'
import type { ArchivePage, MapEntities, MapResource, ResourceState } from './model'
import type { DownloadProgressReporter } from './useEntityManager'
import { md5 } from 'js-md5'
import Apis from '@/api/alova'
import db from '@/database'
import { Zip } from '@/utils/Zip'
import { isEntityId, validateEntities } from './model'
import { decodeLinkGroups } from './sources'

const FORMAT = 1
const MAX_DOWNLOADS = 3
const DIGEST = /^[a-f0-9]{32}$/i
type Session = ReturnType<MapEntitySync['current']>
type PageKey = [string, MapResource, number, string]

const enabled = new Set(import.meta.env.VITE_MAP_ENTITY_ARCHIVES?.split(',').map(key => key.trim()))

async function manifest(resource: MapResource) {
  let list: BinaryMD5Vo[] | undefined
  if (resource === 'marker') list = (await Apis.marker_doc.listMarkerBinaryMD5()).data
  else if (resource === 'item') list = (await Apis.item_doc.listItemBinaryMD5()).data
  else {
    const { data } = await Apis.marker_link_doc.listAllMarkerLinkageBinaryMD5()
    if (data) list = [data]
  }
  if (!Array.isArray(list) || list.length === 0) throw new Error('归档清单为空或格式异常')
  const entries = new Map<string, number>()
  for (const { md5: digest, time } of list) {
    if (
      !digest
      || !DIGEST.test(digest)
      || typeof time !== 'number'
      || !Number.isSafeInteger(time)
      || time <= 0
    )
      throw new Error('归档清单缺少有效摘要或发布时间')
    const key = digest.toLowerCase()
    if (entries.has(key)) throw new Error('归档清单含重复摘要')
    entries.set(key, time)
  }
  const pages = [...entries.keys()].sort()
  const timestamp = Math.max(...entries.values())
  return {
    pages,
    key: `${FORMAT}:${pages.join(',')}`,
    time: timestamp < 1e12 ? timestamp * 1000 : timestamp,
  }
}

async function download(
  resource: MapResource,
  digest: string,
  onBinaryDownload?: BinaryDownloadListener,
) {
  const rawBinary = {
    meta: { raw: true, onBinaryDownload },
    transform: (response: unknown) => (response as Response).arrayBuffer(),
  }

  if (resource === 'marker')
    return Apis.marker_doc.listPageMarkerByBinary({ ...rawBinary, pathParams: { md5: digest } })
  if (resource === 'item')
    return Apis.item_doc.listPageItemByBinary({ ...rawBinary, pathParams: { md5: digest } })
  return Apis.marker_link_doc.listAllMarkerLinkageBinary(rawBinary)
}

export async function decodeArchive(resource: MapResource, bytes: ArrayBuffer, digest: string) {
  if (md5(bytes) !== digest.toLowerCase()) throw new Error('归档正文摘要校验失败')
  const header = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength))
  if (header[0] !== 0x1f || header[1] !== 0x8b) throw new Error('不支持的归档压缩格式')
  const json =
    typeof DecompressionStream === 'function'
      ? await new Response(
          new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
        ).json()
      : JSON.parse(new TextDecoder().decode(await Zip.decompress(new Uint8Array(bytes))))
  return validateArchive(resource, json)
}

export function validateArchive(resource: MapResource, json: unknown) {
  if (resource === 'markerLink') return decodeLinkGroups(json)
  if (!Array.isArray(json)) throw new Error('归档正文不是实体列表')
  const rows = json as MapEntities[typeof resource][]
  validateEntities(rows)
  for (const row of rows) {
    if (
      !Number.isSafeInteger(row.version)
      || (row.version ?? -1) < 0
      || (row.hiddenFlag != null
        && (!Number.isSafeInteger(row.hiddenFlag) || row.hiddenFlag < 0 || row.hiddenFlag > 3))
    )
      throw new Error('归档实体版本或可见标记无效')
    if (resource === 'marker') {
      const marker = row as MarkerVo
      const position = marker.position?.split(',').map(Number) ?? []
      if (
        position.length !== 2
        || !position.every(Number.isFinite)
        || !Array.isArray(marker.itemList)
        || marker.itemList.some(item => !isEntityId(item.itemId))
      )
        throw new Error('点位归档缺少有效坐标或物品引用')
    } else {
      const item = row as ItemVo
      if (
        // 历史资料中 -1 表示尚未归属地区，在线详情也保留这一值。
        (!isEntityId(item.areaId) && item.areaId !== -1)
        || !Array.isArray(item.typeIdList)
        || item.typeIdList.some(id => !isEntityId(id))
      )
        throw new Error('物品归档缺少有效地区或类型')
    }
  }
  return rows
}

export async function stageArchive<K extends MapResource>(
  sync: Pick<MapEntitySync, 'assertCurrent'>,
  session: Session,
  resource: K,
  active: ResourceState | undefined,
  options: {
    maxDownloadPages?: number
    readUnchanged?: boolean
    onDownloadProgress?: DownloadProgressReporter
  } = {},
) {
  if (!enabled.has(resource)) return
  const current = await manifest(resource)
  if (active?.rejectedArchiveKey === current.key) return
  const state = { archiveKey: current.key, archiveTime: current.time, archivePages: current.pages }
  const unchanged = active?.archiveKey === current.key
  if (unchanged && !options.readUnchanged)
    return { state, unchanged: true as const, entities: undefined, removed: [] as number[] }
  const pageKey = (digest: string): PageKey => [session.scope, resource, FORMAT, digest]
  const cached = await db.mapArchivePage.bulkGet(current.pages.map(pageKey))
  const missing = current.pages.filter((_, index) => {
    const page = cached[index]
    return (
      !page
      || !Array.isArray(page.ids)
      || !Array.isArray(page.entities)
      || page.ids.length !== page.entities.length
      || page.entities.some(
        (entity, index) => !isEntityId(entity.id) || entity.id !== page.ids[index],
      )
    )
  })
  if (options.maxDownloadPages !== undefined && missing.length > options.maxDownloadPages) return
  const { onDownloadProgress } = options
  // 清单只提供摘要，按待下载分片均分权重，并累加所有请求实际收到的字节。
  let downloadedPages = 0
  let receivedBytes = 0
  if (missing.length) onDownloadProgress?.(0, 0)
  let cursor = 0
  const worker = async () => {
    while (cursor < missing.length) {
      const digest = missing[cursor++]
      sync.assertCurrent(session)
      let pageBytes = 0
      let pageRatio = 0
      const reportPage = (bytes: number, ratio: number) => {
        const nextRatio = Math.max(pageRatio, ratio)
        if (bytes === pageBytes && nextRatio === pageRatio) return
        receivedBytes += bytes - pageBytes
        downloadedPages += nextRatio - pageRatio
        pageBytes = bytes
        pageRatio = nextRatio
        onDownloadProgress?.(downloadedPages / missing.length, receivedBytes)
      }
      const bytes = await download(
        resource,
        digest,
        onDownloadProgress && ((loaded, total) => reportPage(loaded, total ? loaded / total : 0)),
      )
      reportPage(bytes.byteLength, 1)
      const entities = await decodeArchive(resource, bytes, digest)
      const page: ArchivePage = {
        scope: session.scope,
        resource,
        format: FORMAT,
        digest,
        ids: [...validateEntities<MapEntities[MapResource]>(entities)],
        entities,
      }
      sync.assertCurrent(session)
      await db.mapArchivePage.put(page)
    }
  }
  // 失败时等待同轮下载收尾，已校验成功的页仍可在下一轮复用。
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(MAX_DOWNLOADS, missing.length) }, worker),
  )
  const failure = results.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
  const pages = await db.mapArchivePage.bulkGet(current.pages.map(pageKey))
  const entities = pages.flatMap(page => {
    if (!page || page.ids.length !== page.entities.length) throw new Error('归档暂存页不完整')
    return page.entities
  }) as MapEntities[K][]
  const newIds = validateEntities(entities)
  const confirmed = await manifest(resource)
  if (confirmed.key !== current.key) throw new Error('下载期间归档清单已变更')
  const old = await db.mapArchivePage.bulkGet((active?.archivePages ?? []).map(pageKey))
  const oldIds = new Set(old.flatMap(page => page?.ids ?? []))
  sync.assertCurrent(session)
  return { state, unchanged: false as const, entities, removed: [...oldIds.difference(newIds)] }
}
