import {
  TILE_BYPASS_ACK,
  TILE_BYPASS_PROBE,
} from '@/packages/map/src/utils/tileServiceWorkerProtocol'
import { STATIC_CACHE_CLEAR } from '@/worker/service/utils/static-cache-clear-protocol'
import { legacyStaticCacheName, staticCacheName } from '@/worker/service/utils/static-cache-name'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const origin = 'https://editor.example.test'
const assetBase = 'https://oss.assets.example.test/world'
const fontUrl = 'https://assets.example.test/fonts/ui.woff2'
const iconUrl = assetBase + '/icons/test.png?probe=placeholder'
const fonts = staticCacheName('/', 'fonts', 'cors')
const icons = staticCacheName('/', 'icons', 'cors')
const legacyFonts = legacyStaticCacheName('fonts', 'cors')

const createCache = () => {
  const entries = new Map<string, { request: Request; response: Response }>()
  return {
    match: vi.fn(async (request: Request) => entries.get(request.url)?.response.clone()),
    put: vi.fn(async (request: Request, response: Response) => {
      entries.set(request.url, { request, response: response.clone() })
    }),
    delete: vi.fn(async (request: Request, _options?: CacheQueryOptions) =>
      entries.delete(request.url),
    ),
    keys: vi.fn(async (query?: Request, _options?: CacheQueryOptions) =>
      [...entries.values()]
        .map(({ request }) => request)
        .filter(request => !query || query.url === request.url),
    ),
  }
}
const cacheEntries = new Map<string, ReturnType<typeof createCache>>()
const storage = {
  open: vi.fn(async (name: string) => {
    const cache = cacheEntries.get(name) ?? createCache()
    cacheEntries.set(name, cache)
    return cache
  }),
  keys: vi.fn(async () => [...cacheEntries.keys()]),
  has: vi.fn(async (name: string) => cacheEntries.has(name)),
  delete: vi.fn(async (name: string) => cacheEntries.delete(name)),
  match: vi.fn(async (request: Request, options: { cacheName: string }) =>
    cacheEntries.get(options.cacheName)?.match(request),
  ),
}

const fetchResource = vi.fn<typeof fetch>()
const getClient = vi.fn<Clients['get']>()
const claim = vi.fn(async () => {})

let handleFetch: (
  event: Pick<FetchEvent, 'request' | 'respondWith' | 'waitUntil' | 'clientId'>,
) => void
let handleMessage: (
  event: Pick<ExtendableMessageEvent, 'data' | 'source' | 'ports' | 'waitUntil'>,
) => void
let handleActivate: (event: Pick<ExtendableEvent, 'waitUntil'>) => void

beforeAll(async () => {
  const addEventListener = vi.spyOn(globalThis, 'addEventListener').mockImplementation(() => {})
  vi.stubEnv('VITE_ASSETS_BASE', assetBase + '/')
  vi.stubEnv('VITE_API_BASE', '/api')
  vi.stubGlobal('caches', storage)
  vi.stubGlobal('registration', { scope: origin + '/' })
  try {
    await import('@/worker/service/service.worker')
  } finally {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  }
  const listener = (type: string) =>
    addEventListener.mock.calls.find(([eventType]) => type === eventType)?.[1]
  handleFetch = listener('fetch') as unknown as typeof handleFetch
  handleMessage = listener('message') as unknown as typeof handleMessage
  handleActivate = listener('activate') as unknown as typeof handleActivate
  addEventListener.mockRestore()
})

beforeEach(() => {
  cacheEntries.clear()
  Object.values(storage).forEach(mock => mock.mockReset())
  fetchResource.mockReset()
  getClient.mockReset()
  claim.mockClear()
  vi.stubGlobal('fetch', fetchResource)
  vi.stubGlobal('clients', { get: getClient, claim })
})

afterEach(() => vi.unstubAllGlobals())

const lifetime = () => {
  const pending: Promise<unknown>[] = []
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(promise)
  })
  return {
    waitUntil,
    done: async () => {
      for (const promise of pending) await promise
    },
  }
}
const requestResource = (request: Request, clientId = '') => {
  const work = lifetime()
  const respondWith = vi.fn<FetchEvent['respondWith']>()
  handleFetch({ request, clientId, respondWith, waitUntil: work.waitUntil })
  return {
    ...work,
    respondWith,
    response: async () => {
      expect(respondWith).toHaveBeenCalledOnce()
      return await respondWith.mock.calls[0][0]
    },
  }
}
const requestFont = (init?: RequestInit) => {
  const request = new Request(fontUrl, init)
  // 浏览器发起字体加载时会设置只读的 destination。
  Object.defineProperty(request, 'destination', { value: 'font' })
  return request
}

const asset = (body: string, type = 'image/png', headers?: Record<string, string>) =>
  new Response(body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'max-age=3600',
      Date: new Date().toUTCString(),
      ...headers,
    },
  })

const store = async (name: string, request: Request, response: Response) => {
  const cache = await storage.open(name)
  await cache.put(request, response)
  return cache
}

const clear = (name: string) => {
  const work = lifetime()
  const postMessage = vi.fn()
  handleMessage({
    data: { type: STATIC_CACHE_CLEAR, name },
    source: null,
    ports: [{ postMessage } as unknown as MessagePort],
    waitUntil: work.waitUntil,
  })
  return { ...work, postMessage }
}

describe('Service Worker 直通和诊断', () => {
  it.each([
    () => new Request(`${assetBase}/tiles_twt40/10/-1_2.webp`),
    () => new Request(iconUrl, { method: 'POST' }),
    () => new Request(iconUrl, { headers: { Range: 'bytes=0-10' } }),
    () => new Request(iconUrl, { headers: { Authorization: 'Bearer placeholder' } }),
    () => new Request(iconUrl, { cache: 'no-store' }),
    () => new Request(iconUrl, { cache: 'only-if-cached', mode: 'same-origin' }),
    () => new Request(iconUrl, { credentials: 'include' }),
    () => new Request('http://localhost:9000/icons/test.png'),
    () => new Request('http://127.0.0.1:9000/icons/test.png'),
    () => new Request('http://[::1]:9000/icons/test.png'),
    () => new Request(origin + '/api/icons/test.png'),
    () => new Request(origin + '/oauth/token?refresh_token=placeholder'),
  ])('在监听器中直接放行不应缓存的请求', makeRequest => {
    const { respondWith, waitUntil } = requestResource(makeRequest(), 'first')

    expect(respondWith).not.toHaveBeenCalled()
    expect(waitUntil).not.toHaveBeenCalled()
    expect(storage.open).not.toHaveBeenCalled()
    expect(storage.match).not.toHaveBeenCalled()
    expect(fetchResource).not.toHaveBeenCalled()
    expect(getClient).not.toHaveBeenCalled()
  })

  it('向发出探测的页面确认瓦片直通', () => {
    const postMessage = vi.fn()
    handleMessage({
      data: TILE_BYPASS_PROBE,
      source: { postMessage } as unknown as Client,
      ports: [],
      waitUntil: vi.fn(),
    })

    expect(postMessage).toHaveBeenCalledExactlyOnceWith(TILE_BYPASS_ACK)
    expect(getClient).not.toHaveBeenCalled()
  })

  it('仅向发起页投递资源类别、操作和状态', async () => {
    const postMessage = vi.fn()
    getClient.mockResolvedValue({ type: 'window', postMessage } as unknown as Client)
    fetchResource.mockResolvedValueOnce(asset('图标'))
    const request = new Request(iconUrl)
    const work = requestResource(request, 'first')

    await expect((await work.response()).text()).resolves.toBe('图标')
    await work.done()
    expect(getClient.mock.calls).toEqual([['first'], ['first']])
    expect(postMessage.mock.calls.map(([message]) => message.args)).toEqual([
      ['info', 'icons network 200'],
      ['info', 'icons stored 200'],
    ])
    expect(storage.open).toHaveBeenCalledWith(icons)
    expect(cacheEntries.get(icons)?.put).toHaveBeenCalledWith(request, expect.any(Response))
  })
})

describe('Service Worker 静态资源缓存', () => {
  it.each([
    'application/octet-stream',
    'Application/Octet-Stream; charset=binary',
    'font/woff2',
    'application/font-woff',
    'application/x-font-woff',
  ])('重复加载新鲜的 %s 字体时复用缓存', async contentType => {
    fetchResource.mockResolvedValueOnce(asset('字体', contentType))

    const first = requestResource(requestFont())
    await expect((await first.response()).text()).resolves.toBe('字体')
    await first.done()
    await expect((await requestResource(requestFont()).response()).text()).resolves.toBe('字体')
    expect(fetchResource).toHaveBeenCalledOnce()
    expect(storage.open).toHaveBeenCalledWith(fonts)
  })

  it('丢弃已有的 HTML 缓存，并跳过新的 HTML 响应', async () => {
    const request = requestFont()
    const cache = await store(fonts, request, asset('旧的错误页', 'text/html'))
    fetchResource.mockResolvedValueOnce(asset('新的错误页', 'text/html'))

    const work = requestResource(request)
    await expect((await work.response()).text()).resolves.toBe('新的错误页')
    await work.done()
    expect(cache.delete).toHaveBeenCalledExactlyOnceWith(request)
    await expect(cache.match(request)).resolves.toBeUndefined()
    expect(fetchResource).toHaveBeenCalledOnce()
  })

  it.each(['open', 'match', 'delete', 'put'] as const)(
    '%s 失败时仍传递网络响应',
    async operation => {
      const request = requestFont()
      const cache = await store(fonts, request, asset('错误页', 'text/html'))
      const mock =
        operation === 'delete' || operation === 'put' ? cache[operation] : storage[operation]
      mock.mockRejectedValueOnce(new Error('缓存异常'))
      fetchResource.mockResolvedValueOnce(asset('字体', 'font/woff2'))

      const work = requestResource(request)
      const response = await work.response()
      expect(response.status).toBe(200)
      await expect(response.text()).resolves.toBe('字体')
      await work.done()
      expect(fetchResource).toHaveBeenCalledExactlyOnceWith(request)
    },
  )

  it('后台写入结束前可读取原响应的正文', async () => {
    const request = new Request(iconUrl)
    const cache = await store(icons, request, asset('旧图标'))
    const gate = Promise.withResolvers<void>()
    cache.put.mockImplementationOnce(async () => await gate.promise)
    fetchResource.mockResolvedValueOnce(asset('新图标'))

    const work = requestResource(new Request(iconUrl, { cache: 'reload' }))
    await expect((await work.response()).text()).resolves.toBe('新图标')
    expect(work.waitUntil).toHaveBeenCalledOnce()
    gate.resolve()
    await work.done()
  })

  it('清理 Chromium 写入的不可匹配跨域条目', async () => {
    const request = new Request(iconUrl)
    const cache = await storage.open(icons)
    const response = asset('图标')
    Object.defineProperty(response, 'type', { value: 'cors' })
    fetchResource.mockResolvedValueOnce(response)
    cache.keys.mockResolvedValueOnce([])

    const work = requestResource(request)
    await expect((await work.response()).text()).resolves.toBe('图标')
    await work.done()
    expect(cache.keys).toHaveBeenCalledWith(request)
    expect(cache.delete).toHaveBeenCalledExactlyOnceWith(request, { ignoreVary: true })
    await expect(cache.match(request)).resolves.toBeUndefined()
  })

  it.each(['reload', 'no-cache'] as const)('用调用方的 %s 模式更新原缓存条目', async mode => {
    const request = new Request(iconUrl)
    const cache = await store(icons, request, asset('旧图标'))
    const refresh = new Request(iconUrl, { cache: mode })
    fetchResource.mockResolvedValueOnce(asset('新图标'))

    const work = requestResource(refresh)
    await expect((await work.response()).text()).resolves.toBe('新图标')
    await work.done()
    expect(fetchResource).toHaveBeenCalledExactlyOnceWith(refresh)
    expect(cache.put).toHaveBeenLastCalledWith(refresh, expect.any(Response))
    await expect((await requestResource(request).response()).text()).resolves.toBe('新图标')
  })

  it('普通请求离线时可复用过期副本，强制刷新和取消请求保留网络失败', async () => {
    const request = new Request(iconUrl)
    await store(icons, request, asset('旧图标', 'image/png', { 'Cache-Control': 'max-age=0' }))
    const offline = new TypeError('网络异常')
    fetchResource.mockRejectedValue(offline)

    await expect((await requestResource(request).response()).text()).resolves.toBe('旧图标')
    await expect(
      requestResource(new Request(iconUrl, { cache: 'reload' })).response(),
    ).rejects.toBe(offline)
    const aborted = new DOMException('请求已取消', 'AbortError')
    fetchResource.mockRejectedValueOnce(aborted)
    await expect(requestResource(request).response()).rejects.toBe(aborted)
  })

  it.each(['no-cache', 'max-age=0, must-revalidate'])('%s 要求离线时仍重新验证', async control => {
    const request = new Request(iconUrl)
    await store(icons, request, asset('旧图标', 'image/png', { 'Cache-Control': control }))
    const offline = new TypeError('网络异常')
    fetchResource.mockRejectedValueOnce(offline)

    await expect(requestResource(request).response()).rejects.toBe(offline)
  })

  it.each([403, 404, 500])('原样返回服务器的 %s 响应', async status => {
    const request = new Request(iconUrl)
    const cache = await store(
      icons,
      request,
      asset('旧图标', 'image/png', { 'Cache-Control': 'max-age=0' }),
    )
    fetchResource.mockResolvedValueOnce(new Response('错误详情', { status }))

    const work = requestResource(request)
    const response = await work.response()
    expect(response.status).toBe(status)
    await expect(response.text()).resolves.toBe('错误详情')
    await work.done()
    expect(cache.delete).toHaveBeenCalledTimes(status === 500 ? 0 : 1)
  })
})

describe('Service Worker 升级和手动清理', () => {
  it('写入新库成功后才移除按访问迁入的 v3 字体', async () => {
    const request = requestFont()
    const legacy = await store(legacyFonts, new Request(fontUrl), asset('旧字体', 'font/woff2'))
    const current = await storage.open(fonts)
    current.put.mockRejectedValueOnce(new Error('容量不足'))

    const failed = requestResource(request)
    await expect((await failed.response()).text()).resolves.toBe('旧字体')
    await failed.done()
    expect(legacy.delete).not.toHaveBeenCalled()

    const retried = requestResource(request)
    await expect((await retried.response()).text()).resolves.toBe('旧字体')
    await retried.done()
    expect(current.put).toHaveBeenLastCalledWith(request, expect.any(Response))
    expect(legacy.delete).toHaveBeenCalledExactlyOnceWith(request)
    expect(fetchResource).not.toHaveBeenCalled()
  })

  it('跳过带 Vary 的 v3 条目', async () => {
    const request = requestFont()
    const legacy = await store(
      legacyFonts,
      new Request(fontUrl),
      asset('旧字体', 'font/woff2', { Vary: 'Accept-Language' }),
    )
    fetchResource.mockResolvedValueOnce(asset('新字体', 'font/woff2'))

    const work = requestResource(request)
    await expect((await work.response()).text()).resolves.toBe('新字体')
    await work.done()
    expect(legacy.delete).not.toHaveBeenCalled()
  })

  it('重复激活只清理本应用本作用域的已知旧格式', async () => {
    const outdated = fonts.replace('v=4', 'v=3')
    const retained = [
      legacyFonts,
      fonts,
      fonts.replace('genshin-admin-sw', 'other-app').replace('v=4', 'v=3'),
      staticCacheName('/nested/', 'fonts', 'cors').replace('v=4', 'v=3'),
      fonts.replace('v=4', 'v=5'),
      'n=tiles-twt40&v=3&t=image&m=cors',
      'third-party-cache',
    ]
    await Promise.all([outdated, ...retained].map(name => storage.open(name)))

    for (let index = 0; index < 2; index++) {
      const work = lifetime()
      handleActivate(work)
      await work.done()
      expect([...cacheEntries.keys()]).toEqual(retained)
    }
    expect(claim).toHaveBeenCalledTimes(2)
    expect(storage.delete).toHaveBeenCalledExactlyOnceWith(outdated)
  })

  it.each(['keys', 'delete'] as const)('激活时 %s 失败仍接管页面', async operation => {
    await storage.open(fonts.replace('v=4', 'v=3'))
    storage[operation].mockRejectedValueOnce(new Error('缓存异常'))
    const work = lifetime()

    handleActivate(work)
    await work.done()
    expect(claim).toHaveBeenCalledOnce()
  })

  it('清理时等待在途写入，过滤 v3 条目并拒绝迟到的回填', async () => {
    const current = await storage.open(fonts)
    const legacy = await store(legacyFonts, new Request(fontUrl), asset('旧字体', 'font/woff2'))
    const unrelated = new Request(origin + '/api/ignored')
    await legacy.put(unrelated, asset('其他应用的资源', 'font/woff2'))
    await storage.open('other-app')
    const put = Promise.withResolvers<void>()
    current.put.mockImplementationOnce(async () => await put.promise)
    const slow = Promise.withResolvers<Response>()
    fetchResource.mockResolvedValueOnce(asset('已下载字体', 'font/woff2'))
    fetchResource.mockReturnValueOnce(slow.promise)

    const first = requestResource(requestFont({ cache: 'reload' }))
    await first.response()
    const pending = requestResource(requestFont({ cache: 'reload' }))
    const clearing = clear(legacyFonts)
    expect(clearing.postMessage).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()

    put.resolve()
    await clearing.done()
    slow.resolve(asset('迟到的字体', 'font/woff2'))
    await expect((await pending.response()).text()).resolves.toBe('迟到的字体')
    await Promise.all([first.done(), pending.done()])
    expect(clearing.postMessage).toHaveBeenCalledExactlyOnceWith({ ok: true })
    expect(current.put).toHaveBeenCalledOnce()
    expect(storage.delete).toHaveBeenCalledExactlyOnceWith(fonts)
    expect(await legacy.keys()).toEqual([unrelated])
    expect([...cacheEntries.keys()]).toEqual([legacyFonts, 'other-app'])
  })
})
