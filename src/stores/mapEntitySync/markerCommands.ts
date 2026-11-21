import type { MarkerVo } from '@/api/alova/globals'
import type { MapEntitySync } from './index'
import type { MarkerCommand } from './model'
import Apis, { ApiResponseError } from '@/api/alova'
import db from '@/database'
import { isEntityId, jsonKey } from './model'

export class MarkerCreateUnconfirmed extends Error {
  constructor(readonly mutationId: string) {
    super('创建结果待确认。请核对附近点位或历史记录。')
  }
}

export async function sendMarkerCreate(
  sync: Pick<MapEntitySync, 'assertCurrent' | 'reportError'>,
  session: ReturnType<MapEntitySync['current']>,
  form: MarkerVo,
) {
  const body = jsonKey(form)
  // 上传重试可能返回不同的图片 URL，持续跟踪同一份点位草稿。
  const keyData = new TextEncoder().encode(jsonKey({ ...form, picture: undefined }))
  const key = new Uint8Array(await crypto.subtle.digest('SHA-256', keyData)).reduce(
    (hex, value) => hex + value.toString(16).padStart(2, '0'),
    '',
  )
  const command = await db.transaction('rw', db.mapMarkerCommand, async () => {
    sync.assertCurrent(session)
    const previous = await db.mapMarkerCommand.get([session.scope, key])
    if (previous) return { record: previous, send: false }
    const record: MarkerCommand = {
      scope: session.scope,
      key,
      mutationId: crypto.randomUUID(),
      status: 'sending',
      createdAt: Date.now(),
      draft: JSON.parse(body) as MarkerVo,
    }
    await db.mapMarkerCommand.add(record)
    return { record, send: true }
  })
  const { record } = command
  if (!command.send) {
    if (record.markerId) return record
    throw new MarkerCreateUnconfirmed(record.mutationId)
  }
  let markerId: number
  try {
    sync.assertCurrent(session)
    const { data } = await Apis.marker.createMarker({ data: record.draft })
    if (!isEntityId(data)) throw new Error('服务器未返回新点位 ID')
    markerId = data
  } catch (cause) {
    if (
      cause instanceof ApiResponseError
      && (cause.business || [400, 401, 403, 404, 409, 422].includes(cause.status))
    ) {
      await db.mapMarkerCommand.delete([record.scope, record.key])
      throw cause
    }
    await db.mapMarkerCommand
      .update([record.scope, record.key], { status: 'unknown' })
      .catch(() => undefined)
    throw new MarkerCreateUnconfirmed(record.mutationId)
  }
  const accepted: MarkerCommand = { ...record, markerId, status: 'accepted' }
  // POST 已取得 ID。即使记录回执时磁盘错误，也只按该 ID 回读。
  await db.mapMarkerCommand.put(accepted).catch(cause => sync.reportError(session, cause))
  return accepted
}
