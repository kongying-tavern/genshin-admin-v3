import { describe, expect, it } from 'vitest'
import { CacheMeta } from '@/worker/service/utils/cache-meta'
import {
  classifyStaticCache,
  isObsoleteStaticCache,
  legacyStaticCacheName,
  staticCacheName,
} from '@/worker/service/utils/static-cache-name'

describe('静态资源缓存归属', () => {
  it('将应用、作用域及资源身份编码到新库名，并保留独立的版本号', () => {
    const name = staticCacheName('/', 'icons', 'cors')
    expect(name).toBe('app=genshin-admin-sw&s=%2F&n=icons&v=4&t=image&m=cors')
    expect(CacheMeta.parse(name).version).toBe(4)
    expect(classifyStaticCache(name, '/')).toEqual({
      resource: 'icons',
      mode: 'cors',
      kind: 'current',
    })
    expect(classifyStaticCache(name, '/nested/')).toBeUndefined()
    expect(
      classifyStaticCache(staticCacheName('/nested/', 'overlays', 'no-cors'), '/nested/'),
    ).toEqual({ resource: 'overlays', mode: 'no-cors', kind: 'current' })
    expect(isObsoleteStaticCache(name, '/')).toBe(false)
  })

  it.each([
    ['fonts', 'font'],
    ['icons', 'image'],
    ['overlays', 'image'],
  ] as const)('只在根作用域兼容精确的旧 %s 库名', (resource, type) => {
    const name = legacyStaticCacheName(resource, 'cors')
    expect(name).toBe(`n=${resource}&v=3&t=${type}&m=cors`)
    expect(classifyStaticCache(name, '/')).toEqual({ resource, mode: 'cors', kind: 'legacy' })
    expect(classifyStaticCache(name, '/nested/')).toBeUndefined()
    expect(classifyStaticCache(`v=3&n=${resource}&t=${type}&m=cors`, '/')).toBeUndefined()
    expect(isObsoleteStaticCache(name, '/')).toBe(false)
  })

  it('只淘汰同作用域内带应用标记的已知旧格式', () => {
    const obsolete = staticCacheName('/', 'fonts', 'cors').replace('v=4', 'v=3')
    expect(isObsoleteStaticCache(obsolete, '/')).toBe(true)
    expect(isObsoleteStaticCache(obsolete, '/nested/')).toBe(false)
    expect(classifyStaticCache(obsolete, '/')).toBeUndefined()
  })

  it('不匹配其他应用、未知分类、未知格式或瓦片缓存', () => {
    const valid = staticCacheName('/', 'icons', 'cors')
    for (const name of [
      'foreign-cache',
      'n=tiles-twt40&v=1&m=cors',
      'n=wasm&v=3&t=wasm&m=cors',
      valid.replace('genshin-admin-sw', 'other-app'),
      valid.replace('v=4', 'v=5'),
      valid.replace('v=4', 'v=2'),
      valid.replace('v=4', 'v=04'),
      valid.replace('n=icons', 'n=fonts'),
      valid.replace('m=cors', 'm=navigate'),
      `m=cors&${valid.replace('&m=cors', '')}`,
      `${valid}&v=3`,
      `${valid}&unknown=1`,
    ]) {
      expect(classifyStaticCache(name, '/'), name).toBeUndefined()
      expect(isObsoleteStaticCache(name, '/'), name).toBe(false)
    }
  })
})
