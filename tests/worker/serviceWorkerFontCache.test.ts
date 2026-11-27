import {
  TILE_BYPASS_ACK,
  TILE_BYPASS_PROBE,
} from '@/packages/map/src/utils/tileServiceWorkerProtocol'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const assetBase = 'https://oss.assets.example.test/world'
const fontUrl = 'https://assets.example.test/fonts/ui.woff2'
const cachedResponses = new Map<string, Response>()
const storage = {
  match: async (url: string) => cachedResponses.get(url)?.clone(),
  put: async (url: string, response: Response) => {
    cachedResponses.set(url, response.clone())
  },
  delete: async (url: string) => cachedResponses.delete(url),
}
const fetchResource = vi.fn<typeof fetch>()
const openCache = vi.fn(async () => storage)

let handleFetch: (event: Pick<FetchEvent, 'request' | 'respondWith'>) => void
let handleMessages: ((event: Pick<ExtendableMessageEvent, 'data' | 'source'>) => void)[]

beforeAll(async () => {
  const addEventListener = vi.spyOn(globalThis, 'addEventListener').mockImplementation(() => {})
  vi.stubEnv('VITE_ASSETS_BASE', assetBase + '/')
  try {
    await import('@/worker/service/service.worker')
  } finally {
    vi.unstubAllEnvs()
  }
  handleFetch = addEventListener.mock.calls.find(
    ([type]) => type === 'fetch',
  )?.[1] as unknown as typeof handleFetch
  handleMessages = addEventListener.mock.calls
    .filter(([type]) => type === 'message')
    .map(([, listener]) => listener) as unknown as typeof handleMessages
  addEventListener.mockRestore()
})

beforeEach(() => {
  cachedResponses.clear()
  fetchResource.mockReset()
  openCache.mockClear()
  vi.stubGlobal('fetch', fetchResource)
  vi.stubGlobal('caches', { open: openCache })
  vi.stubGlobal('clients', { matchAll: async () => [] })
})

afterEach(() => vi.unstubAllGlobals())

describe('Service Worker 底图瓦片直通', () => {
  it('在图标规则之前放行 OSS 图源的瓦片', () => {
    const request = new Request(`${assetBase}/tiles_twt40/10/-1_2.webp`, { mode: 'cors' })
    const respondWith = vi.fn<FetchEvent['respondWith']>()
    handleFetch({ request, respondWith })

    expect(respondWith).not.toHaveBeenCalled()
    expect(openCache).not.toHaveBeenCalled()
    expect(fetchResource).not.toHaveBeenCalled()
  })

  it('继续缓存 OSS 图标', async () => {
    const request = new Request(`${assetBase}/icons/test.png`, { mode: 'cors' })
    const respondWith = vi.fn<FetchEvent['respondWith']>()
    fetchResource.mockResolvedValue(
      new Response('icon', { headers: { 'Content-Type': 'image/png' } }),
    )

    handleFetch({ request, respondWith })

    expect(respondWith).toHaveBeenCalledOnce()
    await expect((await respondWith.mock.calls[0][0]).text()).resolves.toBe('icon')
    expect(openCache).toHaveBeenCalledWith('n=icons&v=3&t=image&m=cors')
  })

  it('向发出探测的页面确认瓦片直通', async () => {
    const postMessage = vi.fn()
    const source = { postMessage } as unknown as Client
    await Promise.all(handleMessages.map(handler => handler({ data: TILE_BYPASS_PROBE, source })))
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(TILE_BYPASS_ACK)
  })
})

const fontResponse = (contentType: string, body = 'font') =>
  new Response(body, { headers: { 'Content-Type': contentType } })

const requestFont = async () => {
  const request = new Request(fontUrl, { mode: 'cors' })
  // 还原浏览器发起字体加载时设置的只读 destination。
  Object.defineProperty(request, 'destination', { value: 'font' })
  const respondWith = vi.fn<FetchEvent['respondWith']>()
  handleFetch({ request, respondWith })
  expect(respondWith).toHaveBeenCalledOnce()
  return await respondWith.mock.calls[0][0]
}

describe('Service Worker 字体缓存', () => {
  it.each([
    'application/octet-stream',
    'Application/Octet-Stream; charset=binary',
    'font/woff2',
    'application/font-woff',
    'application/x-font-woff',
  ])('重复加载 %s 字体时复用缓存', async contentType => {
    fetchResource.mockImplementation(async () => fontResponse(contentType))

    await expect((await requestFont()).text()).resolves.toBe('font')
    expect(cachedResponses.has(fontUrl)).toBe(true)
    await expect((await requestFont()).text()).resolves.toBe('font')
    expect(fetchResource).toHaveBeenCalledOnce()
    expect(openCache).toHaveBeenCalledWith('n=fonts&v=3&t=font&m=cors')
  })

  it('丢弃已有的 HTML 缓存，并跳过新的 HTML 响应', async () => {
    cachedResponses.set(fontUrl, fontResponse('text/html', '旧的错误页'))
    fetchResource.mockResolvedValueOnce(fontResponse('text/html', '新的错误页'))

    await expect((await requestFont()).text()).resolves.toBe('新的错误页')
    expect(cachedResponses.has(fontUrl)).toBe(false)

    fetchResource.mockResolvedValueOnce(fontResponse('application/octet-stream'))
    await expect((await requestFont()).text()).resolves.toBe('font')
    expect(cachedResponses.has(fontUrl)).toBe(true)
  })
})
