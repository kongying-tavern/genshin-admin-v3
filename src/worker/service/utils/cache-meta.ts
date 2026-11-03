/** 缓存库元信息 */
export class CacheMeta {
  static parse = (cacheName: string): AppServiceWorker.CacheMeta => {
    const search = new URLSearchParams(cacheName)
    const { n, t, v, m } = Object.fromEntries(search.entries()) as Record<string, string | null>
    return {
      name: n,
      type: t,
      version: v ? Number(v) : null,
      mode: m as RequestMode | null,
    }
  }

  static stringify = (meta: AppServiceWorker.CacheMeta): string => {
    const search = new URLSearchParams()
    if (meta.name !== null) search.set('n', meta.name)
    if (meta.version !== null) search.set('v', meta.version.toString())
    if (meta.type !== null) search.set('t', meta.type)
    if (meta.mode !== null) search.set('m', meta.mode)
    return search.toString()
  }
}
