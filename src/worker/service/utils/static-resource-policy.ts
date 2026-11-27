export type StaticResource = 'fonts' | 'icons' | 'overlays'

type StaticRequest = Pick<Request, 'method' | 'mode' | 'credentials' | 'headers' | 'cache'>

// 系统配置下发的 WOFF2 字体也可能使用 application/octet-stream。
const FONT_CONTENT_TYPE =
  /^(?:font\/[\w.+-]+|application\/(?:(?:x-)?font(?:-[\w.+-]+)?|vnd\.ms-fontobject|octet-stream))\s*(?:;|$)/i
const IMAGE_CONTENT_TYPE = /^image\/[\w.+-]+\s*(?:;|$)/i
const IMAGE_EXTENSION = /\.(?:apng|avif|gif|jpe?g|jfif|pjpeg|pjp|png|svg|webp)$/i
// 图标上传使用 SHA-256 十六进制摘要命名。
const HASHED_FILENAME = /\/[a-f\d]{64}\.[a-z\d]+$/i
const API_PATH = /^\/(?:api|oauth|system|dsp)(?:\/|$)/i

export const resolveStaticApiBase = (base: string | undefined, origin: string) => {
  if (!base) return
  try {
    return new URL(base, origin)
  } catch {
    return undefined
  }
}

const isApiUrl = (url: URL, origin: string, apiBase?: URL) => {
  if (API_PATH.test(url.pathname)) return true
  if (url.origin !== apiBase?.origin) return false
  const basePath = apiBase.pathname.replace(/\/+$/, '')
  if (!basePath) return url.origin !== origin
  return url.pathname === basePath || url.pathname.startsWith(`${basePath}/`)
}

const isPublicStaticGet = (request: StaticRequest, url: URL, origin: string, apiBase?: URL) => {
  const hostname = url.hostname.replace(/\.$/, '')
  return (
    (url.protocol === 'https:' || url.protocol === 'http:')
    && hostname !== 'localhost'
    && !/^127(?:\.\d+){3}$/.test(hostname)
    && hostname !== '[::1]'
    && !url.username
    && !url.password
    && request.method === 'GET'
    && request.mode !== 'navigate'
    && (request.credentials !== 'include' || url.origin === origin)
    && !request.headers.has('Range')
    && !request.headers.has('Authorization')
    && request.cache !== 'no-store'
    && request.cache !== 'only-if-cached'
    && !isApiUrl(url, origin, apiBase)
  )
}

const matchResource = (url: URL, destination: RequestDestination): StaticResource | undefined => {
  if (destination === 'font') return 'fonts'
  if (destination !== 'image' && (destination !== '' || !IMAGE_EXTENSION.test(url.pathname))) return
  if (url.pathname.includes('/d/underground/')) return 'overlays'
  if (url.hostname.startsWith('oss.') || url.pathname.includes('/icons/')) return 'icons'
}

export const classifyStaticRequest = (
  request: Request,
  url: URL,
  origin: string,
  apiBase?: URL,
): StaticResource | undefined => {
  if (isPublicStaticGet(request, url, origin, apiBase))
    return matchResource(url, request.destination)
}

/** v3 以 URL 字符串为键，缓存中的请求不带原始 destination。 */
export const matchesLegacyRequest = (
  request: Request,
  resource: StaticResource,
  url: URL,
  origin: string,
  apiBase?: URL,
) =>
  isPublicStaticGet(request, url, origin, apiBase)
  && matchResource(url, resource === 'fonts' ? 'font' : 'image') === resource

const cacheDirectives = (response: Response) => {
  const directives = new Map<string, string | null>()
  // 引号内的逗号属于指令值，例如 private="x-user,x-session"。
  const parts = response.headers.get('Cache-Control')?.match(/(?:[^",]|"(?:[^"\\]|\\.)*")+/g) ?? []
  for (const part of parts) {
    const separator = part.indexOf('=')
    const name = (separator === -1 ? part : part.slice(0, separator)).trim().toLowerCase()
    const value = separator === -1 ? '' : part.slice(separator + 1).trim()
    directives.set(name, directives.has(name) ? null : value)
  }
  return directives
}

const preventsStorage = (response: Response) => {
  const directives = cacheDirectives(response)
  if (directives.has('private') || directives.has('no-store')) return true
  const vary = response.headers.get('Vary')?.toLowerCase().split(',') ?? []
  // 浏览器附加的凭据不可作为 Cache Storage 匹配时的请求头使用。
  return vary.some(field =>
    ['*', 'cookie', 'authorization', 'proxy-authorization'].includes(field.trim()),
  )
}

export const isCacheableResponse = (response: Response, resource: StaticResource) => {
  const contentType = resource === 'fonts' ? FONT_CONTENT_TYPE : IMAGE_CONTENT_TYPE
  return (
    response.status === 200
    && (response.type === 'basic' || response.type === 'cors' || response.type === 'default')
    && !response.headers.has('Content-Range')
    && contentType.test(response.headers.get('Content-Type') ?? '')
    && !preventsStorage(response)
  )
}

export const canInspectVary = (response: Response) => {
  if (response.type !== 'cors' || response.headers.has('Vary')) return true
  // v3 丢掉了变体请求头。跨域响应必须明确暴露 Vary，才能确认其不存在。
  const exposed =
    response.headers
      .get('Access-Control-Expose-Headers')
      ?.toLowerCase()
      .split(',')
      .map(header => header.trim()) ?? []
  return (
    exposed.includes('vary')
    || (exposed.includes('*') && !exposed.includes('access-control-expose-headers'))
  )
}

export const isLegacyResponse = (response: Response, resource: StaticResource) =>
  canInspectVary(response)
  && !response.headers.get('Vary')
  && isCacheableResponse(response, resource)

export const shouldEvictResponse = (response: Response) =>
  [401, 403, 404, 410].includes(response.status) || preventsStorage(response)

const parseDeltaSeconds = (value: string) => (/^\d+$/.test(value) ? Number(value) : NaN)

export const isFreshResponse = (
  response: Response,
  resource: StaticResource,
  url: URL,
  now = Date.now(),
) => {
  const directives = cacheDirectives(response)
  if (directives.has('no-cache')) return false
  const maxAge = directives.get('max-age')
  const expires = response.headers.get('Expires')
  if (maxAge === undefined && expires === null) {
    return (
      resource === 'icons'
      && HASHED_FILENAME.test(url.pathname)
      && !directives.has('must-revalidate')
    )
  }

  // Age 自身不会随条目在 Cache Storage 中的存储时间增长，缺少 Date 时交给 HTTP 缓存核对。
  const date = Date.parse(response.headers.get('Date') ?? '')
  if (!Number.isFinite(date) || date > now) return false
  const reportedAge = parseDeltaSeconds(response.headers.get('Age') ?? '0')
  const age = Math.max(reportedAge, (now - date) / 1000)
  const lifetime =
    maxAge === undefined
      ? (Date.parse(expires ?? '') - date) / 1000
      : parseDeltaSeconds(maxAge?.replace(/^"(.*)"$/, '$1') ?? '')
  return age < lifetime
}

export const canUseStaleResponse = (response: Response) => {
  const directives = cacheDirectives(response)
  return !directives.has('no-cache') && !directives.has('must-revalidate')
}
