import type { WorkerInput, WorkerOutput } from '@/worker/idb.worker'
import BulkPutWorker from '@/worker/idb.worker?worker'

/** 单次写入的默认超时时间（毫秒） */
const WRITE_TIMEOUT = 30_000

interface PendingWrite {
  resolve: () => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let worker: Worker | undefined
let sequence = 0

const pendingMap = new Map<number, PendingWrite>()

/** 拒绝所有等待中的写入，用于 worker 崩溃时避免 promise 永久挂起 */
const rejectAll = (error: Error) => {
  pendingMap.forEach(({ reject, timer }) => {
    clearTimeout(timer)
    reject(error)
  })
  pendingMap.clear()
}

/** 丢弃当前 worker（崩溃或超时后重建） */
const disposeWorker = (error: Error) => {
  rejectAll(error)
  if (!worker) return
  worker.terminate()
  worker = undefined
}

const handleMessage = (ev: MessageEvent<WorkerOutput>) => {
  const { id } = ev.data
  if (id === undefined) return
  const task = pendingMap.get(id)
  if (!task) return
  pendingMap.delete(id)
  clearTimeout(task.timer)
  if (ev.data.error) task.reject(new Error(ev.data.message || '本地数据库写入失败'))
  else task.resolve()
}

/** 获取（或创建）常驻的数据库写入 worker */
const ensureWorker = () => {
  if (worker) return worker
  const instance = new BulkPutWorker({ name: '本地数据库写入线程' })
  instance.addEventListener('message', handleMessage)
  // worker 脚本本身抛错 / 加载失败时，浏览器只会派发 error 事件，不会走 message
  instance.addEventListener('error', ev => {
    const { message } = ev as ErrorEvent
    disposeWorker(new Error(`本地数据库写入线程异常: ${message || '未知错误'}`))
  })
  instance.addEventListener('messageerror', () => {
    disposeWorker(new Error('本地数据库写入线程收到无法反序列化的消息'))
  })
  worker = instance
  return instance
}

/**
 * 写入本地数据库
 *
 * 与直接 `new Worker()` 的区别：
 * - worker 常驻复用，避免每个分片都新建线程
 * - 以请求 id 建立 ack 机制，**写入失败会 reject 而不是被吞掉**
 * - 线程崩溃 / 消息无法序列化 / 写入超时都会显式报错
 */
export const writeLocalTable = <Key = number, Data = unknown>(
  input: Omit<WorkerInput<Key, Data>, 'id'>,
  options: { timeout?: number } = {},
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const instance = ensureWorker()
    const id = ++sequence
    const timer = setTimeout(() => {
      pendingMap.delete(id)
      reject(new Error(`本地数据库写入超时 (${options.timeout ?? WRITE_TIMEOUT}ms)`))
    }, options.timeout ?? WRITE_TIMEOUT)
    pendingMap.set(id, { resolve, reject, timer })
    try {
      instance.postMessage({ ...input, id } as WorkerInput<Key, Data>)
    } catch (err) {
      pendingMap.delete(id)
      clearTimeout(timer)
      reject(err instanceof Error ? err : new Error(`${err}`))
    }
  })
