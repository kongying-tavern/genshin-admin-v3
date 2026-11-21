import type { MarkerVo, SysUserSmallVo } from '@/api/alova/globals'
import Apis from '@/api/alova'
import { isEntityId } from '@/stores/mapEntitySync/model'
import { messageFrom } from '@/utils/messageFrom'
import { sleep } from '@/utils/sleep'

interface MarkerChunkOptions {
  /** 单次请求携带的点位 id 上限 @default 100 */
  limit?: number
  /** 分片请求的并发数 @default 4 */
  concurrency?: number
  signal?: AbortSignal
}

export interface FetchMarkersByIdsOptions extends MarkerChunkOptions {
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
const MARKER_READ_TIMEOUT = 8_000

export const markerReadConfig = {
  cache: 'no-store',
  shareRequest: false,
} as const

export async function sendMarkerRead<T>(
  method: { send(forceRequest: boolean): Promise<T>; abort(): void },
  signal: AbortSignal,
) {
  signal.throwIfAborted()
  const request = method.send(true)
  const { promise: cancelled, reject } = Promise.withResolvers<never>()
  const cancel = (reason: unknown) => {
    method.abort()
    reject(reason)
  }
  const abort = () => cancel(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  // 请求适配器收到响应头即停止计时，这里也给读取响应正文设置期限。
  const timeout = setTimeout(() => cancel(new Error('点位核对请求超时')), MARKER_READ_TIMEOUT)
  try {
    const result = await Promise.race([request, cancelled])
    signal.throwIfAborted()
    return result
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}

/** 各分片可独立应用结果，切换条件时停止领取新分片。 */
export const visitMarkerIdChunks = async (
  ids: readonly number[],
  visit: (ids: number[], total: number) => Promise<void>,
  { limit = DEFAULT_LIMIT, concurrency = DEFAULT_CONCURRENCY, signal }: MarkerChunkOptions = {},
) => {
  const normalized = [...new Set(ids.filter(isEntityId))]
  const size = Math.max(1, Math.floor(limit))
  const total = normalized.length
  let cursor = 0
  const worker = async () => {
    while (cursor < total) {
      signal?.throwIfAborted()
      const chunk = normalized.slice(cursor, cursor + size)
      cursor += size
      await visit(chunk, total)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), Math.ceil(total / size)) }, worker),
  )
}

export const fetchMarkerChunk = async (
  ids: number[],
  { retry = DEFAULT_RETRY, signal }: Pick<FetchMarkersByIdsOptions, 'retry' | 'signal'> = {},
): Promise<MarkerWithUsers> => {
  let attempt = 0
  while (true) {
    signal?.throwIfAborted()
    try {
      const method = Apis.marker.listMarkerById({
        shareRequest: false,
        ...(signal ? markerReadConfig : {}),
        data: { markerIdList: ids },
      })
      const response = signal ? await sendMarkerRead(method, signal) : await method
      // 合法的空结果为 []，缺失字段或代理回退页面不能作为点位缺失的依据。
      if (!Array.isArray(response?.data)) throw new Error('点位详情响应异常')
      return { markers: response.data, users: response.users ?? {} }
    } catch (err) {
      signal?.throwIfAborted()
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
  const markers: MarkerVo[] = []
  const users: Record<number, SysUserSmallVo> = {}
  let loaded = 0
  await visitMarkerIdChunks(
    ids,
    async (chunk, total) => {
      const { markers: rows, users: chunkUsers } = await fetchMarkerChunk(chunk, options)
      markers.push(...rows)
      Object.assign(users, chunkUsers)
      loaded += chunk.length
      options.onProgress?.(loaded, total)
    },
    options,
  )

  return { markers, users }
}

/** 按 id 批量查询点位，只关心点位数据本身时使用 */
export const fetchMarkersByIds = async (ids: number[], options: FetchMarkersByIdsOptions = {}) => {
  const { markers } = await fetchMarkersWithUsersByIds(ids, options)
  return markers
}
