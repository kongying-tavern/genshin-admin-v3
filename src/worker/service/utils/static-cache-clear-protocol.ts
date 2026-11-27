export const STATIC_CACHE_CLEAR = 'GENSHIN_ADMIN_STATIC_CACHE_CLEAR'

export interface StaticCacheClearRequest {
  type: typeof STATIC_CACHE_CLEAR
  name: string
}

export interface StaticCacheClearResult {
  ok: boolean
}

export const isStaticCacheClearRequest = (data: unknown): data is StaticCacheClearRequest =>
  typeof data === 'object'
  && data !== null
  && 'type' in data
  && data.type === STATIC_CACHE_CLEAR
  && 'name' in data
  && typeof data.name === 'string'
