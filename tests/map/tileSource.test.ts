import type { createTileSource } from '@/packages/map/src/utils/tileSource'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const gate = vi.hoisted(() => ({ allowed: true, epoch: 0 }))
vi.mock('@/packages/map/src/utils/tileServiceWorker', () => ({
  tileCacheAllowed: () => gate.allowed,
  tileCacheEpoch: () => gate.epoch,
}))

const base = 'https://oss.example.test/assets'
const index = { x: -1, y: 2, z: -3 }
const url = `${base}/tiles_twt/10/-1_2.png`
const legacyKey = 'n=tiles-twt&v=3&t=image&m=cors'
const response = (body = 'image', type = 'image/png', status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': type } })

const missing = () => new DOMException('文件不存在', 'NotFoundError')

class TestDirectory {
  kind = 'directory'
  directories = new Map<string, TestDirectory>()
  files = new Map<string, Blob>()

  constructor(
    readonly name: string,
    readonly beforeWrite: () => Promise<void>,
    readonly abort: () => void,
  ) {}

  getDirectoryHandle = vi.fn(async (name: string, { create = false } = {}) => {
    let entry = this.directories.get(name)
    if (!entry) {
      if (!create) throw missing()
      entry = new TestDirectory(name, this.beforeWrite, this.abort)
      this.directories.set(name, entry)
    }
    return entry
  })

  async getFileHandle(name: string, { create = false } = {}) {
    if (!this.files.has(name)) {
      if (!create) throw missing()
      this.files.set(name, new Blob())
    }
    return {
      getFile: async () => this.files.get(name),
      createWritable: async () => {
        let written: Blob
        return {
          write: async (blob: Blob) => {
            await this.beforeWrite()
            written = blob
          },
          close: async () => this.files.set(name, written),
          abort: async () => this.abort(),
        }
      },
    }
  }

  async removeEntry(name: string) {
    if (!this.directories.delete(name)) throw missing()
  }

  async *values() {
    yield* this.directories.values()
  }
}

const makeCacheStorage = () => {
  const sources = new Map<string, Map<string, Response>>()
  const get = (name: string) => {
    const cache = sources.get(name) ?? new Map<string, Response>()
    sources.set(name, cache)
    return cache
  }
  const storage = {
    keys: async () => [...sources.keys()],
    has: async (name: string) => sources.has(name),
    match: vi.fn(async (url: string, { cacheName }: CacheQueryOptions & { cacheName: string }) =>
      sources.get(cacheName)?.get(url)?.clone(),
    ),
    open: async (name: string) => ({
      keys: async () => [...get(name).keys()].map(url => new Request(url)),
      delete: async (key: string | Request) =>
        get(name).delete(typeof key === 'string' ? key : key.url),
    }),
  }
  return { storage, get }
}

const makeBitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap
const fetchTile = vi.fn<typeof fetch>()
const createBitmap = vi.fn<(blob: Blob) => Promise<ImageBitmap>>()
const beforeWrite = vi.fn<() => Promise<void>>()
const abortWrite = vi.fn()
let root: TestDirectory
let cacheStorage: ReturnType<typeof makeCacheStorage>
let load: ReturnType<typeof createTileSource>
let makeSource: typeof createTileSource
let listCaches: typeof import('@/packages/map/src/utils/tileCache').listStorageCaches
let clear: typeof import('@/packages/map/src/utils/tileCache').clearTileCache

beforeEach(async () => {
  vi.resetModules()
  fetchTile.mockReset().mockImplementation(async () => response())
  createBitmap.mockReset().mockImplementation(async () => makeBitmap())
  beforeWrite.mockReset().mockResolvedValue(undefined)
  abortWrite.mockReset()
  root = new TestDirectory('root', beforeWrite, abortWrite)
  cacheStorage = makeCacheStorage()
  vi.stubGlobal('navigator', { storage: { getDirectory: async () => root } })
  vi.stubGlobal('caches', cacheStorage.storage)
  vi.stubGlobal('fetch', fetchTile)
  vi.stubGlobal('createImageBitmap', createBitmap)
  gate.allowed = true
  gate.epoch = 0
  const source = await import('@/packages/map/src/utils/tileSource')
  const cache = await import('@/packages/map/src/utils/tileCache')
  makeSource = source.createTileSource
  load = makeSource(base)
  listCaches = cache.listStorageCaches
  clear = cache.clearTileCache
})

afterEach(() => vi.unstubAllGlobals())

describe('底图瓦片来源', () => {
  it('保留 URL、资源层级、扩展名、CORS 和调用方的信号', async () => {
    const { signal } = new AbortController()
    await expect(load('twt', undefined, index, signal)).resolves.toMatchObject({
      url,
      byteLength: 5,
    })
    await load('twt', 'webp', { x: 1, y: 0, z: 0 }, signal)
    expect(fetchTile).toHaveBeenNthCalledWith(
      1,
      url,
      expect.objectContaining({ mode: 'cors', signal }),
    )
    expect(fetchTile).toHaveBeenNthCalledWith(
      2,
      `${base}/tiles_twt/13/1_0.webp`,
      expect.objectContaining({ mode: 'cors', signal }),
    )
  })

  it('重建图层后继续从 OPFS 读取原始图片，并独立解码位图', async () => {
    const first = await load('twt', undefined, index)
    fetchTile.mockRejectedValue(new Error('断网'))
    const next = await makeSource(base)('twt', undefined, index)

    expect(first?.byteLength).toBe(5)
    expect(next?.byteLength).toBe(first?.byteLength)
    expect(next?.image).not.toBe(first?.image)
    expect(fetchTile).toHaveBeenCalledOnce()
    // 首次查找和创建各打开一次，其余读取复用已打开的层级目录。
    expect(root.getDirectoryHandle).toHaveBeenCalledTimes(2)
  })

  it('坏文件跳过旧库，仅回源一次并覆盖坏文件', async () => {
    await load('twt', undefined, index)
    cacheStorage.get(legacyKey).set(url, response('旧图'))
    fetchTile.mockClear()
    createBitmap.mockRejectedValueOnce(new Error('坏文件'))

    await expect(load('twt', undefined, index)).resolves.toMatchObject({ url, byteLength: 5 })
    expect(fetchTile).toHaveBeenCalledOnce()
    expect(cacheStorage.storage.match).toHaveBeenCalledTimes(1)
    expect(cacheStorage.get(legacyKey).has(url)).toBe(true)
  })

  it('迁移旧 URL，写入失败时保留旧条目', async () => {
    const oldUrl = `${base}//tiles_twt/10/-1_2.png`
    const oldCache = cacheStorage.get(legacyKey)
    oldCache.set(oldUrl, response())
    const trailingBase = makeSource(`${base}/`)
    beforeWrite.mockRejectedValueOnce(new Error('配额不足'))

    await expect(trailingBase('twt', undefined, index)).resolves.toMatchObject({
      url,
      byteLength: 5,
    })
    expect(oldCache.has(oldUrl)).toBe(true)
    expect(abortWrite).toHaveBeenCalledOnce()
    await expect(trailingBase('twt', undefined, index)).resolves.toMatchObject({
      url,
      byteLength: 5,
    })
    expect(oldCache.has(oldUrl)).toBe(false)
    expect(fetchTile).not.toHaveBeenCalled()
  })

  it('另一页面在解码期间删除的旧条目不会重新落盘', async () => {
    const oldCache = cacheStorage.get(legacyKey)
    oldCache.set(url, response())
    createBitmap.mockImplementationOnce(async () => {
      oldCache.delete(url)
      return makeBitmap()
    })

    await expect(load('twt', undefined, index)).resolves.toMatchObject({ url })
    expect(beforeWrite).not.toHaveBeenCalled()
    expect(fetchTile).not.toHaveBeenCalled()
  })

  it.each([
    ['HTML', 'text/html', 200],
    ['部分响应', 'image/png', 206],
    ['错误响应', 'image/png', 404],
  ])('跳过 %s 的持久化', async (_, mime, status) => {
    fetchTile.mockImplementation(async () => response('响应', mime, status))
    if (mime === 'text/html') createBitmap.mockRejectedValueOnce(new Error('无效图片'))
    await load('twt', undefined, index)
    expect(beforeWrite).not.toHaveBeenCalled()
  })

  it('OPFS 不可用和写盘失败都可返回网络图片', async () => {
    const unavailable = vi.fn(async () => {
      throw new DOMException('不可用', 'SecurityError')
    })
    vi.stubGlobal('navigator', { storage: { getDirectory: unavailable } })
    await expect(load('twt', undefined, index)).resolves.toMatchObject({ url })
    expect(beforeWrite).not.toHaveBeenCalled()

    vi.stubGlobal('navigator', { storage: { getDirectory: async () => root } })
    beforeWrite.mockRejectedValueOnce(new Error('配额不足'))
    await expect(load('twt', undefined, index)).resolves.toMatchObject({ url })
    expect(abortWrite).toHaveBeenCalledOnce()
  })

  it('请求取消后释放位图，另一张地图仍可读同一片', async () => {
    const controller = new AbortController()
    const decoding = Promise.withResolvers<ImageBitmap>()
    const started = Promise.withResolvers<void>()
    const abortedBitmap = makeBitmap()
    createBitmap.mockImplementationOnce(() => {
      started.resolve()
      return decoding.promise
    })

    const abandoned = load('twt', undefined, index, controller.signal)
    await started.promise
    controller.abort()
    decoding.resolve(abortedBitmap)
    await expect(abandoned).resolves.toBeNull()
    expect(abortedBitmap.close).toHaveBeenCalledOnce()
    expect(beforeWrite).not.toHaveBeenCalled()
    await expect(load('twt', undefined, index, controller.signal)).resolves.toBeNull()
    await expect(load('twt', undefined, index)).resolves.toMatchObject({ url })
    expect(beforeWrite).toHaveBeenCalledOnce()
    expect(fetchTile).toHaveBeenCalledTimes(2)
  })

  it('控制器确认前走原始请求，切换期间结束的响应不写入 OPFS', async () => {
    gate.allowed = false
    await load('twt', undefined, index)
    expect(cacheStorage.storage.match).not.toHaveBeenCalled()
    expect(beforeWrite).not.toHaveBeenCalled()

    gate.allowed = true
    fetchTile.mockImplementationOnce(async () => {
      gate.epoch++
      return response()
    })
    await expect(load('twt', undefined, index)).resolves.toMatchObject({ url })
    expect(beforeWrite).not.toHaveBeenCalled()
  })
})

describe('按底图清理瓦片', () => {
  it('分别列出图源、保留字体和同名底图的其他图源', async () => {
    const anotherBase = 'https://oss.example.test/another'
    const anotherUrl = url.replace(base, anotherBase)
    const oldCache = cacheStorage.get(legacyKey)
    oldCache.set(url, response())
    oldCache.set(anotherUrl, response())
    cacheStorage.get('n=fonts&v=3&t=font&m=cors')
    await load('other', undefined, index)

    const { cacheKeys, tileCaches } = await listCaches()
    const first = tileCaches.find(tile => tile.source === base)!
    expect(tileCaches).toHaveLength(3)
    expect(cacheKeys).toEqual(['n=fonts&v=3&t=font&m=cors'])
    expect(first).toMatchObject({ code: 'twt', legacy: true, opfs: false })
    await clear(first)

    expect(oldCache.has(url)).toBe(false)
    expect(oldCache.has(anotherUrl)).toBe(true)
    expect((await listCaches()).tileCaches.map(tile => tile.code)).toEqual(['other', 'twt'])
  })

  it('等待在途写入失效，只让选中的底图在清理后回源', async () => {
    await load('twt', undefined, index)
    await load('other', undefined, index)
    const { tileCaches } = await listCaches()
    const selected = tileCaches.find(entry => entry.code === 'twt')!
    const started = Promise.withResolvers<void>()
    const released = Promise.withResolvers<void>()
    beforeWrite.mockImplementationOnce(() => {
      started.resolve()
      return released.promise
    })

    const loading = load('twt', undefined, { ...index, x: 1 })
    await started.promise
    const clearing = clear(selected)
    released.resolve()
    await Promise.all([loading, clearing])
    expect(abortWrite).toHaveBeenCalledOnce()

    fetchTile.mockClear()
    await load('other', undefined, index)
    await load('twt', undefined, index)
    expect(fetchTile).toHaveBeenCalledOnce()
    expect(fetchTile).toHaveBeenCalledWith(url, expect.anything())
  })
})
