import {
  TILE_BYPASS_ACK,
  TILE_BYPASS_PROBE,
} from '@/packages/map/src/utils/tileServiceWorkerProtocol'
import { isTileUrl, normalizeTileBase, parseTileUrl } from '@/packages/map/src/utils/tileUrl'
import { logStaticResource } from './utils/service-worker-logger'
import { isStaticCacheClearRequest } from './utils/static-cache-clear-protocol'
import type { StaticCacheClearResult } from './utils/static-cache-clear-protocol'
import { isObsoleteStaticCache } from './utils/static-cache-name'
import { createStaticResourceCache } from './utils/static-resource-cache'
import {
  classifyStaticRequest,
  matchesLegacyRequest,
  resolveStaticApiBase,
} from './utils/static-resource-policy'

declare const globalThis: ServiceWorkerGlobalScope

const { origin, pathname: scope } = new URL(globalThis.registration.scope)
const tileBase = import.meta.env.VITE_ASSETS_BASE
  ? normalizeTileBase(import.meta.env.VITE_ASSETS_BASE)
  : undefined
const apiBase = resolveStaticApiBase(import.meta.env.VITE_API_BASE, origin)
const storage = globalThis.caches
const resourceCache = createStaticResourceCache({
  storage,
  fetchResource: request => fetch(request),
  scope,
  matchesLegacyEntry: (request, resource) => {
    const url = new URL(request.url)
    return !parseTileUrl(url) && matchesLegacyRequest(request, resource, url, origin, apiBase)
  },
})

globalThis.addEventListener('install', event => {
  // oxlint-disable-next-line eslint/no-console
  console.info('[服务线程] 安装')
  event.waitUntil(globalThis.skipWaiting())
})

globalThis.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      try {
        const names = (await storage.keys()).filter(name => isObsoleteStaticCache(name, scope))
        const results = await Promise.allSettled(names.map(name => storage.delete(name)))
        const deleted = results.filter(result => result.status === 'fulfilled' && result.value)
        const failed = results.filter(result => result.status === 'rejected')
        // oxlint-disable-next-line eslint/no-console
        console.info(`[服务线程] 激活，清理旧缓存库 ${deleted.length} 个，失败 ${failed.length} 个`)
      } catch {
        console.warn('[服务线程] 激活时无法列举缓存库')
      } finally {
        await globalThis.clients.claim()
      }
    })(),
  )
})

globalThis.addEventListener('message', event => {
  const { data, source, ports } = event
  if (data === TILE_BYPASS_PROBE) {
    source?.postMessage(TILE_BYPASS_ACK)
    return
  }

  const port = ports[0]
  if (!port || !isStaticCacheClearRequest(data)) return
  event.waitUntil(
    resourceCache
      .clear(data.name)
      .catch(() => false)
      .then(ok => {
        port.postMessage({ ok } satisfies StaticCacheClearResult)
      }),
  )
})

globalThis.addEventListener('fetch', event => {
  const { request, clientId } = event
  const url = new URL(request.url)
  // 地图包接管底图瓦片和旧缓存迁移。
  if (tileBase && isTileUrl(url, tileBase)) return

  const resource = classifyStaticRequest(request, url, origin, apiBase)
  if (!resource) return

  event.respondWith(
    resourceCache.respond(event, resource, url, (operation, detail) => {
      if (clientId) {
        event.waitUntil(
          logStaticResource(globalThis.clients, clientId, resource, operation, detail),
        )
      }
    }),
  )
})
