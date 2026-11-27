import { describe, expect, it, vi } from 'vitest'
import { logStaticResource } from '@/worker/service/utils/service-worker-logger'
import {
  canUseStaleResponse,
  classifyStaticRequest,
  isCacheableResponse,
  isFreshResponse,
  isLegacyResponse,
  matchesLegacyRequest,
  resolveStaticApiBase,
  shouldEvictResponse,
} from '@/worker/service/utils/static-resource-policy'

const origin = 'https://editor.example'
const iconUrl = new URL('https://oss.example/2026-11-27/icon.png?with_origin=1')
const now = Date.parse('Fri, 27 Nov 2026 08:00:10 GMT')
const date = 'Fri, 27 Nov 2026 08:00:00 GMT'

const assetRequest = (url: URL, init?: RequestInit, destination: RequestDestination = '') => {
  const request = new Request(url, init)
  return Object.defineProperty(request, 'destination', { value: destination })
}

const imageResponse = (headers?: Record<string, string>, status = 200) =>
  new Response('image', { status, headers: { 'Content-Type': 'image/png', ...headers } })

describe('静态资源请求筛选', () => {
  it.each<RequestInit>([
    { method: 'POST' },
    { headers: { Range: 'bytes=0-10' } },
    { headers: { Authorization: 'placeholder' } },
    { credentials: 'include' },
    { cache: 'no-store' },
    { cache: 'only-if-cached', mode: 'same-origin' },
  ])('放行请求 %o', init => {
    expect(classifyStaticRequest(assetRequest(iconUrl, init), iconUrl, origin)).toBeUndefined()
  })

  it.each([
    'http://localhost:9000/icons/a.png',
    'http://LOCALHOST.:9000/icons/a.png',
    'http://127.0.0.1:9000/icons/a.png',
    'http://[::1]:9000/icons/a.png',
    'ftp://oss.example/icons/a.png',
    'https://oss.example/api/icons/a.png',
    'https://oss.example/system/icons/a.png',
    'https://oss.example/oauth/icons/a.png',
    'https://oss.example/upload/info',
  ])('放行地址 %s', href => {
    const url = new URL(href)
    expect(classifyStaticRequest(assetRequest(url), url, origin)).toBeUndefined()
  })

  it('识别配置的代理路径及独立的 API 源', () => {
    const proxyUrl = new URL('/gateway/icons/a.png', origin)
    expect(
      classifyStaticRequest(
        assetRequest(proxyUrl),
        proxyUrl,
        origin,
        resolveStaticApiBase('/gateway', origin),
      ),
    ).toBeUndefined()
    const outsideProxy = new URL('/gateway-static/icons/a.png', origin)
    expect(
      classifyStaticRequest(
        assetRequest(outsideProxy),
        outsideProxy,
        origin,
        resolveStaticApiBase('/gateway', origin),
      ),
    ).toBe('icons')
    expect(
      classifyStaticRequest(
        assetRequest(iconUrl),
        iconUrl,
        origin,
        resolveStaticApiBase(iconUrl.origin, origin),
      ),
    ).toBeUndefined()
  })

  it('按真实用途识别字体、图像和地下图层', () => {
    const fontUrl = new URL('https://assets.example/fonts/name-without-extension')
    expect(classifyStaticRequest(assetRequest(fontUrl, {}, 'font'), fontUrl, origin)).toBe('fonts')
    expect(classifyStaticRequest(assetRequest(fontUrl), fontUrl, origin)).toBeUndefined()
    expect(classifyStaticRequest(assetRequest(iconUrl), iconUrl, origin)).toBe('icons')
    expect(
      classifyStaticRequest(assetRequest(iconUrl, {}, 'script'), iconUrl, origin),
    ).toBeUndefined()

    const iconWithoutExtension = new URL('/icons/a', origin)
    expect(
      classifyStaticRequest(
        assetRequest(iconWithoutExtension, {}, 'image'),
        iconWithoutExtension,
        origin,
      ),
    ).toBe('icons')
    const overlay = new URL('https://oss.example/d/underground/a.svg')
    expect(classifyStaticRequest(assetRequest(overlay), overlay, origin)).toBe('overlays')
    expect(matchesLegacyRequest(assetRequest(overlay), 'icons', overlay, origin)).toBe(false)
    expect(matchesLegacyRequest(assetRequest(overlay), 'overlays', overlay, origin)).toBe(true)
  })

  it('放行导航，即使地址具有图标扩展名', () => {
    const navigation = Object.defineProperty(assetRequest(iconUrl), 'mode', { value: 'navigate' })
    expect(classifyStaticRequest(navigation, iconUrl, origin)).toBeUndefined()
  })
})

describe('静态资源响应策略', () => {
  it.each<Record<string, string>>([
    { 'Content-Type': 'text/html' },
    { 'Content-Range': 'bytes 0-3/100' },
    { Vary: 'Accept, *' },
    { Vary: 'Cookie' },
    { 'Cache-Control': 'private="x-user,x-session", max-age=60' },
    { 'Cache-Control': 'public, NO-STORE' },
  ])('跳过不适合复用的响应头 %o', headers => {
    expect(isCacheableResponse(imageResponse(headers), 'icons')).toBe(false)
  })

  it('只接受可读的完整响应，并保留字体二进制类型兼容', () => {
    expect(isCacheableResponse(imageResponse({}, 206), 'overlays')).toBe(false)
    const opaque = Object.defineProperty(imageResponse(), 'type', { value: 'opaque' })
    expect(isCacheableResponse(opaque, 'icons')).toBe(false)
    const font = imageResponse({ 'Content-Type': 'application/octet-stream; charset=binary' })
    expect(isCacheableResponse(font, 'fonts')).toBe(true)
    expect(isCacheableResponse(font, 'icons')).toBe(false)
    expect(isLegacyResponse(imageResponse({ Vary: 'Accept-Language' }), 'icons')).toBe(false)
    expect(isCacheableResponse(imageResponse({ Vary: 'Accept-Language' }), 'icons')).toBe(true)
  })

  it('跨域旧条目须能确认无 Vary，新的原始请求键可由原生匹配处理变体', () => {
    const cors = (headers?: Record<string, string>) =>
      Object.defineProperty(imageResponse(headers), 'type', { value: 'cors' })
    expect(isLegacyResponse(cors(), 'icons')).toBe(false)
    expect(isCacheableResponse(cors(), 'icons')).toBe(true)
    expect(isLegacyResponse(cors({ 'Access-Control-Expose-Headers': '*' }), 'icons')).toBe(true)
    expect(
      isLegacyResponse(
        cors({ 'Access-Control-Expose-Headers': 'Access-Control-Expose-Headers, Vary' }),
        'icons',
      ),
    ).toBe(true)
    expect(
      isLegacyResponse(
        cors({ 'Access-Control-Expose-Headers': 'Access-Control-Expose-Headers, *' }),
        'icons',
      ),
    ).toBe(false)
    expect(
      isLegacyResponse(cors({ 'Access-Control-Expose-Headers': '*', Vary: 'Accept' }), 'icons'),
    ).toBe(false)
  })

  it('撤回或禁用缓存时删除旧副本，并保留暂时失败的旧副本', () => {
    expect(shouldEvictResponse(imageResponse({}, 403))).toBe(true)
    expect(shouldEvictResponse(imageResponse({}, 404))).toBe(true)
    expect(shouldEvictResponse(imageResponse({ 'Cache-Control': 'private' }))).toBe(true)
    expect(shouldEvictResponse(imageResponse({}, 502))).toBe(false)
  })

  it('从 Date、Age 和显式寿命判断新鲜度', () => {
    const fresh = (headers: Record<string, string>) =>
      isFreshResponse(imageResponse(headers), 'icons', iconUrl, now)
    expect(fresh({ Date: date, 'Cache-Control': 'max-age="11"' })).toBe(true)
    expect(fresh({ Date: date, 'Cache-Control': 'max-age=10' })).toBe(false)
    expect(fresh({ Date: date, Age: '11', 'Cache-Control': 'max-age=11' })).toBe(false)
    expect(fresh({ Age: '1', 'Cache-Control': 'max-age=60' })).toBe(false)
    expect(fresh({ Date: date, 'Cache-Control': 'max-age=60, max-age=10' })).toBe(false)
    expect(fresh({ Date: date, Expires: 'Fri, 27 Nov 2026 08:00:59 GMT' })).toBe(true)
    expect(fresh({ Date: date, 'Cache-Control': 'extra="foo,no-cache,bar", max-age=30' })).toBe(
      true,
    )
  })

  it('摘要命名的图标可长期复用，并遵循服务器要求的重新验证', () => {
    const hashed = new URL(`/icons/${'ab'.repeat(32)}.png?with_origin=1`, origin)
    const fresh = (control: string) =>
      isFreshResponse(imageResponse({ 'Cache-Control': control }), 'icons', hashed, now)
    expect(fresh('public')).toBe(true)
    expect(fresh('no-cache')).toBe(false)
    expect(fresh('must-revalidate')).toBe(false)
    expect(fresh('max-age=0')).toBe(false)
    expect(isFreshResponse(imageResponse(), 'overlays', hashed, now)).toBe(false)
    expect(canUseStaleResponse(imageResponse({ 'Cache-Control': 'max-age=3' }))).toBe(true)
    expect(canUseStaleResponse(imageResponse({ 'Cache-Control': 'no-cache="ETag"' }))).toBe(false)
    expect(canUseStaleResponse(imageResponse({ 'Cache-Control': 'must-revalidate' }))).toBe(false)
  })
})

describe('静态资源日志', () => {
  it('仅向请求窗口发送兼容消息，且清除异常 URL 和自定义名称', async () => {
    const postMessage = vi.fn()
    const get = vi.fn<Clients['get']>().mockResolvedValue({
      frameType: 'top-level',
      id: 'first-window',
      type: 'window',
      url: origin,
      postMessage,
    })
    const error = new Error('https://example.com/?token=placeholder')
    error.name = 'https://example.com/?name=placeholder'
    await logStaticResource({ get }, 'first-window', 'icons', 'put-error', error)
    expect(get).toHaveBeenCalledExactlyOnceWith('first-window')
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({
      id: expect.any(String),
      type: 'request',
      channel: 'log',
      args: ['error', 'icons put-error Error'],
    })
  })

  it('跳过没有请求窗口的日志，窗口关闭或投递失败时静默结束', async () => {
    const get = vi.fn<Clients['get']>().mockResolvedValue(undefined)
    await logStaticResource({ get }, '', 'fonts', 'network', 200)
    expect(get).not.toHaveBeenCalled()
    await logStaticResource({ get }, 'closed-window', 'fonts', 'network', 200)
    get.mockRejectedValue(new Error('窗口已关闭'))
    await expect(
      logStaticResource({ get }, 'closed-window', 'fonts', 'network', 200),
    ).resolves.toBeUndefined()
  })
})
