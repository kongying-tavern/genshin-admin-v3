const tilePath = /^(.*)\/tiles_([^/]+)\/-?\d+\/-?\d+_-?\d+\.[a-zA-Z0-9][a-zA-Z0-9._-]*$/

export const normalizeTileBase = (base: string, reference = globalThis.location?.href): string => {
  if (!base) throw new TypeError('未配置瓦片资源地址')
  const url = new URL(base, reference)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError('瓦片资源地址必须使用 HTTP(S)')
  }
  return url.origin + url.pathname.replace(/\/+$/, '')
}

export const tileUrl = (
  base: string,
  code: string,
  resourceLevel: number,
  x: number,
  y: number,
  extension: string,
): string => `${base}/tiles_${encodeURIComponent(code)}/${resourceLevel}/${x}_${y}.${extension}`

export const parseTileUrl = (value: string | URL): { base: string; code: string } | null => {
  try {
    const url = typeof value === 'string' ? new URL(value) : value
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const path = url.pathname.match(tilePath)
    if (!path) return null
    return {
      base: url.origin + path[1].replace(/\/+$/, ''),
      code: decodeURIComponent(path[2]),
    }
  } catch {
    return null
  }
}

export const isTileUrl = (url: string | URL, base: string): boolean =>
  parseTileUrl(url)?.base === base
