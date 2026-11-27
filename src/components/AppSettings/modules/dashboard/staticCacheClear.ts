import type {
  StaticCacheClearRequest,
  StaticCacheClearResult,
} from '@/worker/service/utils/static-cache-clear-protocol'
import { STATIC_CACHE_CLEAR } from '@/worker/service/utils/static-cache-clear-protocol'

export const clearStaticCache = async (name: string): Promise<void> => {
  const registration = await navigator.serviceWorker?.getRegistration()
  const worker = registration?.active
  if (!worker) throw new Error('静态资源服务线程未就绪')

  const { port1, port2 } = new MessageChannel()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      const onFailure = () => reject(new Error('静态资源缓存清理失败'))
      timeout = setTimeout(onFailure, 30_000)
      port1.onmessageerror = onFailure
      port1.onmessage = ({ data }: MessageEvent<StaticCacheClearResult>) => {
        if (data?.ok === true) resolve()
        else onFailure()
      }
      worker.postMessage({ type: STATIC_CACHE_CLEAR, name } satisfies StaticCacheClearRequest, [
        port2,
      ])
    })
  } finally {
    clearTimeout(timeout)
    port1.close()
    port2.close()
  }
}
