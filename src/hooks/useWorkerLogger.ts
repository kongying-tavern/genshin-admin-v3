import type { LoggerOptions } from '@/utils/logger'
import { Logger } from '@/utils/logger'

export const useLoggerWorker = <I, O>(
  ev: MessageEvent<I>,
  label: string,
  options: Omit<LoggerOptions, 'port'> = {},
) => {
  const [mainPort, loggerPort] = ev.ports

  const logger = new Logger(label, {
    ...options,
    port: loggerPort,
  })

  const send = (data: O, transfer: Transferable[] = []) => {
    mainPort.postMessage(data, transfer)
  }

  return {
    send,
    logger,
  }
}
