import type { LogInfo } from '.'
import { Logger } from '.'

export interface WorkerHelperOptions {
  cacheWorker?: boolean
}

/**
 * #### Worker 包装函数
 * 必须按照如下类型输出结果
 * - string 类型表示错误原因
 * - 对象类型表示成功结果
 */
export const createWorkerHelper = <Input, Output>(
  worker: Worker,
  options: WorkerHelperOptions = {},
) => {
  const { cacheWorker = true } = options

  return (payload: Input, transfer: Transferable[] = []) =>
    new Promise<Output>((resolve, reject) => {
      const mainChannel = new MessageChannel()
      const loggerChannel = new MessageChannel()

      mainChannel.port1.onmessage = (ev: MessageEvent<Output | string>) => {
        !cacheWorker && worker.terminate()
        const { data } = ev
        if (typeof data === 'string') return reject(new Error(data))
        resolve(data)
      }

      loggerChannel.port1.onmessage = ({ data }: MessageEvent<LogInfo>) => {
        if (Logger.isInit) {
          Logger.event.emit('register', data.label)
          Logger.event.emit('log', data)
        } else {
          Logger.loggerLabelsCache.add(data.label)
          Logger.logsCache.push(data)
        }
      }

      worker.postMessage(payload, [mainChannel.port2, loggerChannel.port2, ...transfer])
    })
}
