import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const fontUrl = 'https://assets.example.test/fonts/ui.woff2'
const cachedResponses = new Map<string, Response>()
const storage = {
  match: async (url: string) => cachedResponses.get(url)?.clone(),
  put: async (url: string, response: Response) => {
    cachedResponses.set(url, response.clone())
  },
  delete: async (url: string) => cachedResponses.delete(url),
}
const fetchFont = vi.fn<typeof fetch>()

let handleFetch: (event: Pick<FetchEvent, 'request' | 'respondWith'>) => void

beforeAll(async () => {
  const addEventListener = vi.spyOn(globalThis, 'addEventListener').mockImplementation(() => {})
  await import('@/worker/service/service.worker')
  handleFetch = addEventListener.mock.calls.find(
    ([type]) => type === 'fetch',
  )?.[1] as unknown as typeof handleFetch
  addEventListener.mockRestore()
})

beforeEach(() => {
  cachedResponses.clear()
  fetchFont.mockReset()
  vi.stubGlobal('fetch', fetchFont)
  vi.stubGlobal('caches', { open: async () => storage })
  vi.stubGlobal('clients', { matchAll: async () => [] })
})

afterEach(() => vi.unstubAllGlobals())

const fontResponse = (contentType: string, body = 'font') =>
  new Response(body, { headers: { 'Content-Type': contentType } })

const requestFont = async () => {
  const request = new Request(fontUrl, { mode: 'cors' })
  // 还原浏览器发起字体加载时设置的只读 destination。
  const fontRequest = Object.defineProperty(request, 'destination', { value: 'font' })
  vi.spyOn(fontRequest, 'clone').mockReturnValue(fontRequest)
  const respondWith = vi.fn<FetchEvent['respondWith']>()
  handleFetch({ request: fontRequest, respondWith })
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
    fetchFont.mockImplementation(async () => fontResponse(contentType))

    await expect((await requestFont()).text()).resolves.toBe('font')
    expect(cachedResponses.has(fontUrl)).toBe(true)
    await expect((await requestFont()).text()).resolves.toBe('font')
    expect(fetchFont).toHaveBeenCalledOnce()
  })

  it('丢弃已有的 HTML 缓存，并跳过新的 HTML 响应', async () => {
    cachedResponses.set(fontUrl, fontResponse('text/html', '旧的错误页'))
    fetchFont.mockResolvedValueOnce(fontResponse('text/html', '新的错误页'))

    await expect((await requestFont()).text()).resolves.toBe('新的错误页')
    expect(cachedResponses.has(fontUrl)).toBe(false)

    fetchFont.mockResolvedValueOnce(fontResponse('application/octet-stream'))
    await expect((await requestFont()).text()).resolves.toBe('font')
    expect(cachedResponses.has(fontUrl)).toBe(true)
  })
})
