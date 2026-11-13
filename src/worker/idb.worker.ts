import { WorkerThreadDB } from '@/database/db/worker'

declare const globalThis: DedicatedWorkerGlobalScope

const db = new WorkerThreadDB()

export interface WorkerInput<Key = number, Data = unknown> {
  /** 请求 id，用于主线程建立 ack 映射（旧调用方可省略） */
  id?: number
  tableName: string
  clear?: boolean
  bulkPutData?: Data[]
  bulkDeleteKeys?: Key[]
}

export interface WorkerOutput {
  /** 对应的请求 id */
  id?: number
  error?: boolean
  message: string
}

globalThis.addEventListener('message', async (ev: MessageEvent<WorkerInput>) => {
  const { id, tableName, clear = false, bulkPutData = [], bulkDeleteKeys = [] } = ev.data
  try {
    const table = db.table(tableName)
    await db.transaction('rw!', table, async () => {
      if (clear) await table.clear()
      else if (bulkDeleteKeys.length) await table.bulkDelete(bulkDeleteKeys)
      if (bulkPutData.length) await table.bulkPut(bulkPutData)
    })
    globalThis.postMessage({
      id,
      message: 'success',
    } as WorkerOutput)
  } catch (err) {
    globalThis.postMessage({
      id,
      error: true,
      message: err instanceof Error ? err.message : `${err}`,
    } as WorkerOutput)
  }
})
