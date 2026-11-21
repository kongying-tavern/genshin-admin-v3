import { WorkerIPC } from '@/utils/worker/worker-ipc'
import { CacheMeta } from '@/worker/service/utils/cache-meta'
import { ServiceWorkerLogger } from '@/worker/service/utils/service-worker-logger'

declare const globalThis: ServiceWorkerGlobalScope

const ipc = new WorkerIPC<never, AppServiceWorker.EventMap>({
  addEventListener: (...args: Parameters<MessagePort['addEventListener']>) => {
    globalThis.addEventListener(...args)
  },
  postMessage: async request => {
    const clients = await globalThis.clients.matchAll({ includeUncontrolled: true })
    clients.forEach(client => client.postMessage(request))
  },
})

const logger = new ServiceWorkerLogger(ipc)

// ==================== global env ====================

const VERSION = 3
const AVAILABLE_DESTINATION = new Set(['audio', 'font', 'image', 'video'])
// 系统配置下发的 WOFF2 字体以 application/octet-stream 提供。
const FONT_CONTENT_TYPE =
  /^(?:font\/[\w.+-]+|application\/(?:(?:x-)?font(?:-[\w.+-]+)?|vnd\.ms-fontobject|octet-stream))\s*(?:;|$)/i
const IMAGE_TYPES = new Set([
  'apng',
  'avif',
  'gif',
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'png',
  'svg',
  'webp',
])

// ====================   on install   ====================

globalThis.addEventListener('install', ev => {
  logger.info('install')
  ev.waitUntil(globalThis.skipWaiting())
})

// ====================    on activate    ====================

/**
 * 检查过期缓存
 * - 缓存附加信息的表示格式示例: `n=tiles-twt40&v=1&m=cors`
 */
const clearOutDatedCache = async () => {
  const allCacheNames = await caches.keys()
  await Promise.all(
    allCacheNames.map(async cacheName => {
      const { version } = CacheMeta.parse(cacheName)
      const isOutDated = version === null || version < VERSION
      if (!isOutDated) return
      logger.info(`clear out dated cache "${cacheName}"`)
      await globalThis.caches.delete(cacheName)
    }),
  )
}

globalThis.addEventListener('activate', ev => {
  logger.info('activate')
  ev.waitUntil(
    (async () => {
      await clearOutDatedCache()
      await globalThis.clients.claim()
    })(),
  )
})

// ====================    on fetch    ====================

/** 匹配缓存库 */
const matchCache = (
  urlObject: URL,
  destination: string,
): { name: string; typeValidate?: RegExp } | null => {
  const { host, pathname } = urlObject

  // 1. 地图切片
  const tilesCode = pathname.match(/tiles_([a-zA-Z0-9]+)\//)?.[1]
  if (tilesCode) return { name: `tiles-${tilesCode}`, typeValidate: /^image\// }

  // 2. 附加图层
  if (pathname.includes('/d/underground/')) return { name: 'overlays', typeValidate: /^image\// }

  // 3. 字体
  if (destination === 'font') return { name: 'fonts', typeValidate: FONT_CONTENT_TYPE }

  // 4. 图标
  if (host.startsWith('oss.') || pathname.includes('/icons/'))
    return { name: 'icons', typeValidate: /^image\// }

  // 5. 瓦片
  if (pathname.endsWith('.wasm')) return { name: 'wasm' }

  return null
}

globalThis.addEventListener('fetch', ev => {
  const { url, mode, destination: rawDestination } = ev.request.clone()
  const urlObject = new URL(url)
  const { protocol, host, pathname } = urlObject

  logger.info(`fetch ${url}`)

  // 由元素发起的请求会获取此值，但 fetch 发起的请求就没有了，需要通过技术手段确定
  const destination =
    rawDestination
    || (() => {
      const extname = (pathname.match(/(\.[a-z0-9]+)$/i)?.[1] ?? '.unknown')
        .replace('.', '')
        .toLowerCase()
      if (IMAGE_TYPES.has(extname)) return 'image'
      return ''
    })()

  if (
    [
      !protocol.startsWith('http'),
      host === 'localhost',
      host === '127.0.0.1',
      !AVAILABLE_DESTINATION.has(destination),
    ].some(Boolean)
  ) {
    return
  }

  const storageMeta = matchCache(urlObject, destination)
  if (!storageMeta) return

  const matchesContentType = (contentType: string | null) =>
    !storageMeta.typeValidate || storageMeta.typeValidate.test(contentType ?? '')

  ev.respondWith(
    (async () => {
      try {
        const storageName = CacheMeta.stringify({
          version: VERSION,
          mode,
          name: storageMeta.name,
          type: destination,
        })
        const storage = await globalThis.caches.open(storageName)
        const maybeCachedResponse = await storage.match(url)

        if (maybeCachedResponse) {
          const contentType = maybeCachedResponse.headers.get('Content-Type')
          if (matchesContentType(contentType)) {
            logger.info(
              `cache "${url}" hit in storage "${storageName}" with contentType "${contentType}"`,
            )
            return maybeCachedResponse
          }
          await storage.delete(url)
        }

        const res = await fetch(ev.request)

        if (res.status === 200 && matchesContentType(res.headers.get('Content-Type'))) {
          await storage.put(url, res.clone())
          logger.info(`cache "${url}" success in storage "${storageName}"`)
        }

        return res
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request Error'
        logger.error(`handle fetch "${url}" caused by "${message}"`)
        return new Response(null, {
          status: 404,
          statusText: message,
        })
      }
    })(),
  )
})
