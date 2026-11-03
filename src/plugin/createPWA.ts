import type { Plugin } from 'vue'
import { Logger } from '@/utils'
import { PageIPC } from '@/utils/worker'

const logger = new Logger('服务线程')

export type ServiceWorkerOutput = {
  action: 'log'
  value: { type: 'info' | 'error'; args: string[] }
} & {
  action: string
  value: unknown
}

/** 渐进式 Web 应用所需配置 */
export const createPWA = (): Plugin => ({
  install: async () => {
    const port = {
      addEventListener: (...args: Parameters<MessagePort['addEventListener']>) => {
        navigator.serviceWorker.addEventListener(...args)
      },
      removeEventListener: (...args: Parameters<MessagePort['removeEventListener']>) => {
        navigator.serviceWorker.removeEventListener(...args)
      },
      postMessage: ((...args: Parameters<MessagePort['postMessage']>) => {
        navigator.serviceWorker.controller?.postMessage(...args)
      }) as MessagePort['postMessage'],
    }

    const ipc = new PageIPC<never, AppServiceWorker.EventMap>(port)
    navigator.serviceWorker.startMessages()

    ipc.on('log', (type, message) => {
      logger[type](message)
    })

    await navigator.serviceWorker?.register(
      import.meta.env.MODE === 'production' ? '/service.worker.js' : '/dev-sw.js?dev-sw',
      { type: 'module' },
    )
    await navigator.serviceWorker.ready
  },
})
