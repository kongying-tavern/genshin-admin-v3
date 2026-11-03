import { WorkerThreadDB } from '@/database/db/worker'

declare const globalThis: DedicatedWorkerGlobalScope

const db = new WorkerThreadDB()

export interface WorkerInput<Key = number, Data = unknown> {
  tableName: string
  clear?: boolean
  bulkPutData?: Data[]
  bulkDeleteKeys?: Key[]
}

export interface WorkerOutput {
  error?: boolean
  message: string
}

globalThis.addEventListener('message', async (ev: MessageEvent<WorkerInput>) => {
  try {
    const { tableName, clear = false, bulkPutData = [], bulkDeleteKeys = [] } = ev.data

    const table = db.table(tableName)
    await db.transaction('rw!', table, async () => {
      if (clear) await table.clear()
      else if (bulkDeleteKeys.length) await table.bulkDelete(bulkDeleteKeys)
      if (bulkPutData.length) await table.bulkPut(bulkPutData)
    })
    globalThis.postMessage({
      message: 'success',
    } as WorkerOutput)
  } catch (err) {
    globalThis.postMessage({
      error: true,
      message: err instanceof Error ? err.message : `${err}`,
    } as WorkerOutput)
  }
})
