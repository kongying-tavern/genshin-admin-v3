import { classifyStaticCache, legacyStaticCacheName, staticCacheName } from './static-cache-name'
import type { StaticResourceOperation } from './service-worker-logger'
import type { StaticResource } from './static-resource-policy'
import {
  canInspectVary,
  canUseStaleResponse,
  isCacheableResponse,
  isFreshResponse,
  isLegacyResponse,
  shouldEvictResponse,
} from './static-resource-policy'

type Log = (operation: StaticResourceOperation, detail?: unknown) => void

interface ResourceState {
  generation: number
  pending: Map<string, Promise<void>>
  clearing?: Promise<void>
}

interface StaticResourceCacheOptions {
  storage: CacheStorage
  fetchResource: typeof fetch
  scope: string
  matchesLegacyEntry: (request: Request, resource: StaticResource) => boolean
}

export const createStaticResourceCache = ({
  storage,
  fetchResource,
  scope,
  matchesLegacyEntry,
}: StaticResourceCacheOptions) => {
  const states: Record<StaticResource, ResourceState> = {
    fonts: { generation: 0, pending: new Map() },
    icons: { generation: 0, pending: new Map() },
    overlays: { generation: 0, pending: new Map() },
  }

  const clear = async (name: string) => {
    const identity = classifyStaticCache(name, scope)
    if (!identity) return false

    const { resource, mode } = identity
    const state = states[resource]
    // 正在回源的请求在清理后也不能回填，已登记的写入先等待完成。
    state.generation++
    const { clearing, pending } = state
    const task = (async () => {
      await Promise.allSettled([clearing, ...pending.values()])

      if (scope === '/') {
        const legacy = legacyStaticCacheName(resource, mode)
        if (await storage.has(legacy)) {
          const cache = await storage.open(legacy)
          for (const request of await cache.keys()) {
            if (!matchesLegacyEntry(request, resource)) continue
            const response = await cache.match(request)
            if (response && isLegacyResponse(response, resource)) await cache.delete(request)
          }
        }
      }
      await storage.delete(staticCacheName(scope, resource, mode))
    })()

    state.clearing = task
    try {
      await task
      return true
    } finally {
      if (state.clearing === task) delete state.clearing
    }
  }

  const respond = async (
    event: Pick<FetchEvent, 'request' | 'waitUntil'>,
    resource: StaticResource,
    url: URL,
    log: Log,
  ) => {
    const { request } = event
    const state = states[resource]
    const { generation, clearing } = state
    const name = staticCacheName(scope, resource, request.mode)
    const legacy = scope === '/' ? legacyStaticCacheName(resource, request.mode) : undefined
    const explicitReload = request.cache === 'reload' || request.cache === 'no-cache'

    // 同一 URL 的写入与删除按登记顺序执行，其他资源仍可并行回填。
    const mutate = (operation: () => Promise<void>, failure: 'put-error' | 'delete-error') => {
      if (clearing || state.generation !== generation) return
      const key = request.url + '\n' + request.mode
      const previous = state.pending.get(key)
      const task = (previous ?? Promise.resolve())
        .then(operation)
        .catch(error => log(failure, error))
      state.pending.set(key, task)
      void task.then(() => {
        if (state.pending.get(key) === task) state.pending.delete(key)
      })
      event.waitUntil(task)
    }

    const match = async (cacheName: string) => {
      try {
        return await storage.match(request, { cacheName })
      } catch (error) {
        log('match-error', error)
      }
    }

    const open = async (cacheName: string) => {
      try {
        return await storage.open(cacheName)
      } catch (error) {
        log('open-error', error)
      }
    }

    const deleteEntry = async (cacheName: string) => {
      const cache = await open(cacheName)
      try {
        await cache?.delete(request)
      } catch (error) {
        log('delete-error', error)
      }
    }

    const deleteLegacy = async () => {
      if (!legacy || !matchesLegacyEntry(request, resource)) return
      const response = await match(legacy)
      if (response && isLegacyResponse(response, resource)) await deleteEntry(legacy)
    }

    const store = (response: Response) => {
      if (clearing || state.generation !== generation) return
      let copy: Response
      try {
        copy = response.clone()
      } catch (error) {
        log('put-error', error)
        return
      }
      mutate(async () => {
        const cache = await open(name)
        if (!cache) return
        try {
          await cache.put(request, copy)
          // Chromium 可能写入 CORS 隐藏的 Vary: *，但原请求无法匹配该条目。
          if (!canInspectVary(response) && !(await cache.keys(request)).length) {
            const options = { ignoreVary: true }
            if ((await cache.keys(request, options)).length === 1) {
              await cache.delete(request, options)
            }
            return
          }
          log('stored', response.status)
        } catch (error) {
          log('put-error', error)
          return
        }
        await deleteLegacy()
      }, 'put-error')
    }

    let cached: Response | undefined
    let fromLegacy = false
    if (!clearing && !explicitReload) {
      const current = await match(name)
      if (current && isCacheableResponse(current, resource)) {
        cached = current
      } else {
        if (current) {
          mutate(async () => {
            const entry = await match(name)
            if (entry && !isCacheableResponse(entry, resource)) await deleteEntry(name)
          }, 'delete-error')
        }
        if (legacy && matchesLegacyEntry(request, resource)) {
          const old = await match(legacy)
          if (old && isLegacyResponse(old, resource)) {
            cached = old
            fromLegacy = true
          }
        }
      }

      if (cached && isFreshResponse(cached, resource, url)) {
        if (fromLegacy) store(cached)
        log('hit', cached.status)
        return cached
      }
    }

    let response: Response
    try {
      response = await fetchResource(request)
    } catch (error) {
      log('fetch-error', error)
      if (
        cached
        && !request.signal.aborted
        && !(
          (error instanceof Error || error instanceof DOMException)
          && error.name === 'AbortError'
        )
        && canUseStaleResponse(cached)
      ) {
        if (fromLegacy) store(cached)
        log('stale', cached.status)
        return cached
      }
      throw error
    }

    log('network', response.status)
    if (isCacheableResponse(response, resource)) {
      store(response)
    } else if (shouldEvictResponse(response)) {
      mutate(async () => {
        if (await match(name)) await deleteEntry(name)
        await deleteLegacy()
      }, 'delete-error')
    }
    return response
  }

  return { clear, respond }
}
