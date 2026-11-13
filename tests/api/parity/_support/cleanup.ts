import fs from 'node:fs'
import path from 'node:path'
import { api } from './client'
import { parityEnv, REPORTS_DIR, runId } from './env'
import { getToken } from './session'

/**
 * 测后清理（双环境独立、幂等、可审计）
 *
 * 已由副作用探测证实 Java 与 Rust **共享同一个数据库**，因此：
 *  - 每次运行使用独立 runId 前缀，两端数据天然隔离；
 *  - 清理按引用顺序从叶到根执行；
 *  - 共享库下「对象已被删除」会返回 200 + error:true，视为已清理而非失败；
 *  - 清理结果一律写入残留清单，失败不再静默吞掉。
 */

export type EntityType = 'linkage' | 'marker' | 'item' | 'icon' | 'itemType' | 'iconType' | 'area' | 'user'

type Tracked = { type: EntityType; id: number | string; groupId?: string }

const tracked: Tracked[] = []

export const track = (type: EntityType, id: number | string, groupId?: string) => {
  tracked.push({ type, id, groupId })
}

const DELETE_PATHS: Record<EntityType, (id: number | string) => string> = {
  linkage: () => '/api/marker_link/delete',
  marker: id => `/api/marker/${id}`,
  item: id => `/api/item/delete/${id}`,
  icon: id => `/api/icon/delete/${id}`,
  itemType: id => `/api/item_type/delete/${id}`,
  iconType: id => `/api/icon_type/delete/${id}`,
  area: id => `/api/area/${id}`,
  user: id => `/system/user/${id}`,
}

/** 引用顺序：先解关联，再删点位/物品/图标/分类，最后删地区与用户 */
const CLEANUP_ORDER: EntityType[] = ['linkage', 'marker', 'item', 'icon', 'itemType', 'iconType', 'area', 'user']

export type CleanupRecord = {
  type: EntityType
  id: number | string
  status: number
  errorFlag: unknown
  outcome: 'deleted' | 'already-gone' | 'failed'
  detail?: string
}

export const cleanupAll = async (): Promise<CleanupRecord[]> => {
  const snapshot = tracked.splice(0)
  if (!snapshot.length) return []

  let token: string | null = null
  try {
    token = await getToken()
  } catch {
    // 登录失效时仍尝试无凭据删除，结果会如实记为残留
  }

  const records: CleanupRecord[] = []
  for (const type of CLEANUP_ORDER) {
    for (const entity of snapshot.filter(item => item.type === type)) {
      const body = type === 'linkage'
        ? (entity.groupId ? { groupIds: [entity.groupId] } : { ids: [Number(entity.id)] })
        : undefined

      try {
        const res = await api(token, 'DELETE', DELETE_PATHS[type](entity.id), body)
        const errorFlag = (res.body as any)?.error
        const data = (res.body as any)?.data
        const alreadyGone = errorFlag === true || data === false || data === null
        const outcome: CleanupRecord['outcome'] = !res.ok
          ? 'failed'
          : alreadyGone ? 'already-gone' : (res.status === 200 ? 'deleted' : 'failed')
        records.push({
          type,
          id: entity.id,
          status: res.status,
          errorFlag,
          outcome,
          detail: outcome === 'failed' ? res.networkError ?? res.bodyText.slice(0, 200) : undefined,
        })
      } catch (error) {
        records.push({
          type,
          id: entity.id,
          status: 0,
          errorFlag: null,
          outcome: 'failed',
          detail: String(error instanceof Error ? error.message : error),
        })
      }
    }
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(REPORTS_DIR, `cleanup-${parityEnv}.json`),
    JSON.stringify({ env: parityEnv, runId, at: new Date().toISOString(), records }, null, 2),
  )

  const leftovers = records.filter(record => record.outcome === 'failed')
  if (leftovers.length)
    console.warn(`[parity] ${parityEnv} 清理残留 ${leftovers.length} 项，详见 cleanup-${parityEnv}.json`)

  return records
}
