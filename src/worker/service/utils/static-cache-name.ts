import type { StaticResource } from './static-resource-policy'
import { CacheMeta } from './cache-meta'

const APP = 'genshin-admin-sw'
const VERSION = 4
const LEGACY_VERSION = 3

const resourceTypes = {
  fonts: 'font',
  icons: 'image',
  overlays: 'image',
} satisfies Record<StaticResource, string>

export interface StaticCacheIdentity {
  resource: StaticResource
  mode: RequestMode
}

export const staticCacheName = (scope: string, resource: StaticResource, mode: RequestMode) =>
  new URLSearchParams({
    app: APP,
    s: scope,
    n: resource,
    v: String(VERSION),
    t: resourceTypes[resource],
    m: mode,
  }).toString()

export const legacyStaticCacheName = (resource: StaticResource, mode: RequestMode) =>
  CacheMeta.stringify({
    name: resource,
    version: LEGACY_VERSION,
    type: resourceTypes[resource],
    mode,
  })

const readIdentity = (params: URLSearchParams): StaticCacheIdentity | undefined => {
  const resource = params.get('n')
  if (resource !== 'fonts' && resource !== 'icons' && resource !== 'overlays') return
  if (params.get('t') !== resourceTypes[resource]) return

  const mode = params.get('m')
  if (mode !== 'cors' && mode !== 'no-cors' && mode !== 'same-origin') return

  return { resource, mode }
}

const matchesMarkedFormat = (params: URLSearchParams, scope: string, version: number) =>
  Array.from(params.keys()).length === 6
  && params.get('app') === APP
  && params.get('s') === scope
  && params.get('v') === String(version)

export const classifyStaticCache = (
  name: string,
  scope: string,
): (StaticCacheIdentity & { kind: 'current' | 'legacy' }) | undefined => {
  const params = new URLSearchParams(name)
  const identity = readIdentity(params)
  if (!identity) return
  if (name === staticCacheName(scope, identity.resource, identity.mode)) {
    return { ...identity, kind: 'current' }
  }

  // 无应用标记的旧库仅兼容根作用域，且须与旧代码实际使用的完整名称一致。
  if (scope === '/' && name === legacyStaticCacheName(identity.resource, identity.mode)) {
    return { ...identity, kind: 'legacy' }
  }
}

export const isObsoleteStaticCache = (name: string, scope: string): boolean => {
  const params = new URLSearchParams(name)
  return matchesMarkedFormat(params, scope, LEGACY_VERSION) && !!readIdentity(params)
}
