import type { MarkerVo, SysUserSmallVo } from '@/api/alova/globals'
import Apis from '@/api/alova'
import { messageFrom } from '@/utils/messageFrom'
import { sleep } from '@/utils/sleep'

export interface FetchMarkersByIdsOptions {
  /** 单次请求携带的点位 id 上限 @default 100 */
  limit?: number
  /** 分片请求的并发数 @default 4 */
  concurrency?: number
  /** 单批请求失败后的重试次数 @default 2 */
  retry?: number
  /** 分片进度回调，`loaded` 为已完成的点位数量 */
  onProgress?: (loaded: number, total: number) => void
}

export interface MarkerWithUsers {
  markers: MarkerVo[]
  users: Record<number, SysUserSmallVo>
}

/** 服务端对 `markerIdList` 有长度限制，超过会直接报错，这里保守取 100 */
const DEFAULT_LIMIT = 100
const DEFAULT_CONCURRENCY = 4
const DEFAULT_RETRY = 2

/** 清洗点位 id：剔除非正整数并去重，避免脏数据进入请求体 */
const normalizeIds = (ids: number[]) => {
  const seen = new Set<number>()
  const result: number[] = []
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    if (!Number.isSafeInteger(id) || id <= 0) continue
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

const chunkIds = (ids: number[], size: number) => {
  const chunks: number[][] = []
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size))
  return chunks
}

const requestChunk = async (ids: number[], retry: number) => {
  let attempt = 0
  while (true) {
    try {
      return await Apis.marker.listMarkerById({ data: { markerIdList: ids } })
    } catch (err) {
      if (attempt >= retry)
        throw new Error(
          `点位批量查询失败（${ids.length} 个点位，已重试 ${attempt} 次）：${messageFrom(err)}`,
        )
      attempt++
      await sleep(200 * attempt)
    }
  }
}

/**
 * 按 id 批量查询点位，内部自动分片、限流并重试，同时保留接口返回的用户信息
 *
 * `markerIdList` 过长时服务端会直接拒绝，因此不能把任意规模的 id 一次性丢给接口。
 */
export const fetchMarkersWithUsersByIds = async (
  ids: number[],
  options: FetchMarkersByIdsOptions = {},
): Promise<MarkerWithUsers> => {
  const {
    limit = DEFAULT_LIMIT,
    concurrency = DEFAULT_CONCURRENCY,
    retry = DEFAULT_RETRY,
    onProgress,
  } = options

  const normalized = normalizeIds(ids)
  const total = normalized.length
  if (!total) return { markers: [], users: {} }

  const chunks = chunkIds(normalized, Math.max(1, Math.floor(limit)))
  const markers: MarkerVo[] = []
  const users: Record<number, SysUserSmallVo> = {}
  let loaded = 0
  let cursor = 0

  // 并发池：每个 worker 依次领取下一个分片，直到分片耗尽
  const worker = async () => {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++]
      const { data = [], users: chunkUsers = {} } = await requestChunk(chunk, retry)
      markers.push(...data)
      Object.assign(users, chunkUsers)
      loaded += chunk.length
      onProgress?.(loaded, total)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker))

  return { markers, users }
}

/** 按 id 批量查询点位，只关心点位数据本身时使用 */
export const fetchMarkersByIds = async (ids: number[], options: FetchMarkersByIdsOptions = {}) => {
  const { markers } = await fetchMarkersWithUsersByIds(ids, options)
  return markers
}
