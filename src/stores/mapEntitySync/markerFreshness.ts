import type { MarkerVo } from '@/api/alova/globals'
import type { MapEntitySync } from './index'
import Apis from '@/api/alova'
import { HistoryActionType, HistoryRecordType } from '@/shared/history'
import { fetchMarkerChunk, markerReadConfig, sendMarkerRead } from '../utils/fetchMarkersByIds'
import { isEntityId } from './model'
import { checkDetails } from './sources'

type Sync = Pick<MapEntitySync, 'current' | 'assertCurrent' | 'refresh' | 'commit' | 'projection'>

interface VerifyOptions {
  signal: AbortSignal
  canReadHistory: boolean
  canSee: (hiddenFlag?: number) => boolean
  onDeleted: () => void
}

async function readDeletedMarkers(ids: number[], signal: AbortSignal) {
  const { data } = await sendMarkerRead(
    Apis.history.searchHistory({
      ...markerReadConfig,
      data: {
        id: ids,
        type: HistoryRecordType.MARKER,
        editType: `${HistoryActionType.DELETE}`,
        current: 1,
        size: ids.length,
      },
    }),
    signal,
  )
  if (!Array.isArray(data?.record)) return []
  const requested = new Set(ids)
  return data.record.flatMap(row =>
    row?.type === HistoryRecordType.MARKER
    && Number(row.editType) === HistoryActionType.DELETE
    && isEntityId(row.tid)
    && requested.has(row.tid)
      ? [row.tid]
      : [],
  )
}

/** 单批交互核对独立于全量更新队列，使用请求开始前的修订号处理并发写入。 */
export async function verifyMarkerBatch(
  sync: Sync,
  session: ReturnType<Sync['current']>,
  ids: number[],
  { signal, canReadHistory, canSee, onDeleted }: VerifyOptions,
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted()
    const { state, deletedMarkerIds } = await sync.refresh(session)
    const requested = ids.filter(id => !deletedMarkerIds.has(id))
    if (!requested.length) return new Map<number, MarkerVo>()

    sync.assertCurrent(session)
    const { markers } = await fetchMarkerChunk(requested, { retry: 0, signal })
    const missing = checkDetails(markers, requested)
    const updates = markers.filter(marker => canSee(marker.hiddenFlag))
    const unavailable = markers.filter(marker => !canSee(marker.hiddenFlag)).map(({ id }) => id!)

    sync.assertCurrent(session)
    // 详情接口也会过滤当前账号不可见的点位。只有明确的删除记录才能建立墓碑。
    const confirmedDeleteIds =
      missing.length && canReadHistory
        ? await readDeletedMarkers(missing, signal).catch(() => [])
        : []
    signal.throwIfAborted()
    const commit = await sync.commit(session, {
      revision: state.revision,
      atomic: true,
      batches: {
        marker: { updates, deletes: [...missing, ...unavailable], confirmedDeleteIds },
      },
    })
    sync.assertCurrent(session)
    if (commit.conflict) continue
    if (commit.rows.some(row => row.deleted)) onDeleted()

    const { marker } = sync.projection.entities
    return new Map(
      updates.flatMap(({ id: markerId }) => {
        const id = markerId!
        const row = marker.get(id)
        return row && canSee(row.hiddenFlag) ? [[id, row]] : []
      }),
    )
  }
  throw new Error('核对期间点位有变化，请重试')
}
