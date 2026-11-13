import type { WorkerInput, WorkerOutput } from '@/worker/idb.worker'
import BulkPutWorker from '@/worker/idb.worker?worker'

export interface BulkWriteOptions<K, D> {
  /** 线程名称，便于在浏览器的任务管理器中辨认 */
  name: string
  tableName: string
  clear?: boolean
  bulkPutData?: D[]
  bulkDeleteKeys?: K[]
  /** 写入进度回调，`loaded` 为已处理的条目数 */
  onProgress?: (loaded: number, total: number) => void
}

export interface BulkWriteResult {
  error: boolean
  message: string
}

/**
 * 在独立线程中分批写入 IndexedDB，并等待写入真正落库
 *
 * 与直接 `postMessage` 相比：写入过程中的批次进度会通过 `onProgress` 回传，
 * 且 `await` 返回时事务已经结束，调用方可以放心地把「写入」也纳入整体进度。
 */
export const bulkWrite = <K, D>(options: BulkWriteOptions<K, D>): Promise<BulkWriteResult> => {
  const { name, onProgress, ...payload } = options
  const worker = new BulkPutWorker({ name })
  const { resolve, promise } = Promise.withResolvers<BulkWriteResult>()

  worker.addEventListener('message', (ev: MessageEvent<WorkerOutput>) => {
    const data = ev.data
    if (data.kind === 'progress') {
      onProgress?.(data.loaded, data.total)
      return
    }
    worker.terminate()
    resolve({ error: !!data.error, message: data.message })
  })

  // 线程异常时不能让调用方一直等下去，否则整个更新流程会静默挂住
  worker.addEventListener('error', ev => {
    worker.terminate()
    resolve({ error: true, message: ev.message || '数据写入线程异常' })
  })

  worker.postMessage(payload as WorkerInput<K, D>)

  return promise
}
