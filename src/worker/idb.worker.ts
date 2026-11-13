import { WorkerThreadDB } from '@/database/db/worker'

declare const globalThis: DedicatedWorkerGlobalScope

const db = new WorkerThreadDB()

/**
 * 单批写入的条目数
 *
 * 分片写入不会改变事务的原子性（所有分片仍在同一个事务内），
 * 但可以在长写入过程中不断回报进度，避免界面长时间停在同一个百分比。
 */
const CHUNK_SIZE = 1000

/** 两次进度上报的最小间隔，过于频繁的 postMessage 反而会拖慢写入 */
const REPORT_INTERVAL = 100

export interface WorkerInput<Key = number, Data = unknown> {
  tableName: string
  clear?: boolean
  bulkPutData?: Data[]
  bulkDeleteKeys?: Key[]
}

/** 写入过程中的进度上报 */
export interface WorkerProgressOutput {
  kind: 'progress'
  /** 已处理的条目数 */
  loaded: number
  /** 需要处理的条目总数 */
  total: number
}

/** 写入结束（成功或失败） */
export interface WorkerDoneOutput {
  kind: 'done'
  error?: boolean
  message: string
}

export type WorkerOutput = WorkerProgressOutput | WorkerDoneOutput

globalThis.addEventListener('message', async (ev: MessageEvent<WorkerInput>) => {
  try {
    const { tableName, clear = false, bulkPutData = [], bulkDeleteKeys = [] } = ev.data

    const table = db.table(tableName)
    // clear 会清空整张表，此时待删除的键已无意义
    const total = bulkPutData.length + (clear ? 0 : bulkDeleteKeys.length)
    let loaded = 0
    let lastReport = 0

    const report = (force = false) => {
      const timestamp = performance.now()
      if (!force && loaded < total && timestamp - lastReport < REPORT_INTERVAL) return
      lastReport = timestamp
      globalThis.postMessage({ kind: 'progress', loaded, total } as WorkerProgressOutput)
    }

    report()

    await db.transaction('rw!', table, async () => {
      if (clear) await table.clear()
      else if (bulkDeleteKeys.length) {
        await table.bulkDelete(bulkDeleteKeys)
        loaded += bulkDeleteKeys.length
        report()
      }
      for (let i = 0; i < bulkPutData.length; i += CHUNK_SIZE) {
        const chunk = bulkPutData.slice(i, i + CHUNK_SIZE)
        await table.bulkPut(chunk)
        loaded += chunk.length
        report()
      }
    })

    // 最后一条进度保证落在 100%，避免节流丢掉收尾的上报
    report(true)
    globalThis.postMessage({
      kind: 'done',
      message: 'success',
    } as WorkerDoneOutput)
  } catch (err) {
    globalThis.postMessage({
      kind: 'done',
      error: true,
      message: err instanceof Error ? err.message : `${err}`,
    } as WorkerDoneOutput)
  }
})
