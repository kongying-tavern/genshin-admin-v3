import { md5 } from 'js-md5'
import { CacheMeta } from '@/worker/service/utils/cache-meta'
import { normalizeTileBase, parseTileUrl } from './tileUrl'

const ROOT_DIRECTORY = 'map-tiles'
const MAP_PREFIX = 'tiles_'
const LEGACY_PREFIX = 'tiles-'
const LEGACY_VERSION = 3
const MAX_LEVEL_HANDLES = 64

export interface TileCacheEntry {
  sourceKey: string
  source?: string
  code: string
  legacy: boolean
  opfs: boolean
}

type CacheSelection = Pick<TileCacheEntry, 'sourceKey' | 'code'>

interface TileCacheRequest {
  base: string
  code: string
  level: number
  url: string
  alternateLegacyUrl?: string
}

interface MapWrites {
  generation: number
  pending: Set<Promise<void>>
  clearing?: Promise<void>
}

const tileSourceKey = (base: string) => md5(base)
const mapDirectoryName = (code: string) => MAP_PREFIX + encodeURIComponent(code)
const mapPath = ({ sourceKey, code }: CacheSelection) => `${sourceKey}/${mapDirectoryName(code)}`
const legacyCacheName = (code: string) =>
  CacheMeta.stringify({
    name: LEGACY_PREFIX + code,
    version: LEGACY_VERSION,
    type: 'image',
    mode: 'cors',
  })

const levelHandles = new Map<
  string,
  { opening: Promise<FileSystemDirectoryHandle>; create: boolean }
>()
const mapWrites = new Map<string, MapWrites>()
let rootHandle: Promise<FileSystemDirectoryHandle> | undefined

const getRoot = async () => {
  rootHandle ??= navigator.storage.getDirectory().catch(error => {
    rootHandle = undefined
    throw error
  })
  return rootHandle
}

const sourceDirectory = async (sourceKey: string, create = false) => {
  const root = await (await getRoot()).getDirectoryHandle(ROOT_DIRECTORY, { create })
  return root.getDirectoryHandle(sourceKey, { create })
}

const isMissing = (error: unknown) =>
  error instanceof DOMException && error.name === 'NotFoundError'

const getLevelDirectory = async (entry: CacheSelection, level: number, create: boolean) => {
  const key = `${mapPath(entry)}/${level}`
  const existing = levelHandles.get(key)
  if (existing) {
    levelHandles.delete(key)
    levelHandles.set(key, existing)
    try {
      return await existing.opening
    } catch (error) {
      if (!create || existing.create || !isMissing(error)) throw error
      return getLevelDirectory(entry, level, true)
    }
  }

  const opening = (async () => {
    const source = await sourceDirectory(entry.sourceKey, create)
    const map = await source.getDirectoryHandle(mapDirectoryName(entry.code), { create })
    return map.getDirectoryHandle(String(level), { create })
  })()
  levelHandles.set(key, { opening, create })
  if (levelHandles.size > MAX_LEVEL_HANDLES) {
    const oldest = levelHandles.keys().next().value
    if (oldest !== undefined) levelHandles.delete(oldest)
  }
  try {
    return await opening
  } catch (error) {
    if (levelHandles.get(key)?.opening === opening) levelHandles.delete(key)
    throw error
  }
}

const withMapLock = async (path: string, mode: LockMode, run: () => Promise<void>) =>
  navigator.locks ? navigator.locks.request(`${ROOT_DIRECTORY}/${path}`, { mode }, run) : run()

const getMapWrites = (path: string) => {
  let writes = mapWrites.get(path)
  if (!writes) {
    writes = { generation: 0, pending: new Set() }
    mapWrites.set(path, writes)
  }
  return writes
}

export const isCacheableTileResponse = (response: Response) =>
  response.status === 200
  && !response.headers.has('Content-Range')
  && /^image\/[\w.+-]+(?:\s*;|\s*$)/i.test(response.headers.get('Content-Type') ?? '')

/** 每次加载捕获清理代数，避免已退出的请求在清理后重新落盘。 */
export const openTileCache = ({ base, code, level, url, alternateLegacyUrl }: TileCacheRequest) => {
  const entry = { sourceKey: tileSourceKey(base), code }
  const path = mapPath(entry)
  const fileName = new URL(url).pathname.split('/').at(-1)!
  const legacyName = legacyCacheName(code)
  const writes = getMapWrites(path)
  const generation = writes.generation
  const available = !writes.clearing
  const current = () => available && !writes.clearing && writes.generation === generation

  const read = async () => {
    if (!current()) return null
    try {
      const directory = await getLevelDirectory(entry, level, false)
      const file = await (await directory.getFileHandle(fileName)).getFile()
      return current() && file.size > 0 ? file : null
    } catch {
      return null
    }
  }

  const readLegacy = async () => {
    if (!current()) return null
    try {
      const candidates = alternateLegacyUrl ? [url, alternateLegacyUrl] : [url]
      for (const legacyUrl of candidates) {
        const response = await globalThis.caches.match(legacyUrl, { cacheName: legacyName })
        if (!current()) return null
        if (!response || !isCacheableTileResponse(response)) continue
        const blob = await response.blob()
        if (current() && blob.size > 0) return { blob, legacyUrl }
      }
      return null
    } catch {
      return null
    }
  }

  const openFileForWrite = async () => {
    const getFile = async () =>
      (await getLevelDirectory(entry, level, true)).getFileHandle(fileName, { create: true })
    try {
      return await getFile()
    } catch (error) {
      if (!isMissing(error)) throw error
      // 其他页面清理底图后，重新取得该层级的目录句柄。
      levelHandles.delete(`${path}/${level}`)
      return getFile()
    }
  }

  const write = async (blob: Blob, allow: () => boolean, legacyUrl?: string) => {
    const canWrite = () => current() && allow()
    if (!canWrite()) return

    const pending = withMapLock(path, 'shared', async () => {
      if (!canWrite()) return
      // 其他页面可能已在本次解码期间清理旧库。
      const legacyStorage = legacyUrl ? globalThis.caches : null
      if (legacyUrl && !(await legacyStorage?.match(legacyUrl, { cacheName: legacyName }))) return
      if (!canWrite()) return
      const file = await openFileForWrite()
      if (!canWrite()) return
      const stream = await file.createWritable()
      let committed = false
      try {
        if (!canWrite()) return
        await stream.write(blob)
        if (!canWrite()) return
        await stream.close()
        committed = true
      } finally {
        if (!committed) await stream.abort().catch(() => {})
      }

      if (legacyStorage && legacyUrl && canWrite() && (await legacyStorage.has(legacyName))) {
        await (await legacyStorage.open(legacyName)).delete(legacyUrl)
      }
    }).catch(() => {
      // 存储不可用或写满时，图层仍可使用已经解码的位图。
    })
    writes.pending.add(pending)
    try {
      await pending
    } finally {
      writes.pending.delete(pending)
    }
  }

  return { current, read, readLegacy, write }
}

const clearOpfs = async (entry: CacheSelection) => {
  if (!(await getRoot().catch(() => null))) return
  try {
    const source = await sourceDirectory(entry.sourceKey)
    await source.removeEntry(mapDirectoryName(entry.code), { recursive: true })
  } catch (error) {
    if (!isMissing(error)) throw error
  }
}

const clearLegacy = async ({ sourceKey, code }: CacheSelection) => {
  const name = legacyCacheName(code)
  const storage = globalThis.caches
  if (!storage || !(await storage.has(name))) return
  const cache = await storage.open(name)
  for (const request of await cache.keys()) {
    const tile = parseTileUrl(request.url)
    if (tile?.code === code && tileSourceKey(tile.base) === sourceKey) {
      await cache.delete(request)
    }
  }
}

export const clearTileCache = (entry: CacheSelection): Promise<void> => {
  const path = mapPath(entry)
  const writes = getMapWrites(path)
  if (writes.clearing) return writes.clearing

  writes.generation++
  writes.clearing = (async () => {
    await Promise.all(writes.pending)
    await withMapLock(path, 'exclusive', async () => {
      const results = await Promise.allSettled([clearOpfs(entry), clearLegacy(entry)])
      for (const result of results) {
        if (result.status === 'rejected') throw result.reason
      }
    })
  })().finally(() => {
    for (const key of levelHandles.keys()) {
      if (key.startsWith(`${path}/`)) levelHandles.delete(key)
    }
    writes.clearing = undefined
  })
  return writes.clearing
}

const currentSource = () => {
  try {
    return normalizeTileBase(import.meta.env.VITE_ASSETS_BASE)
  } catch {
    return undefined
  }
}

export const listStorageCaches = async () => {
  const entries = new Map<string, TileCacheEntry>()
  const base = currentSource()

  const mark = (entry: CacheSelection, kind: 'opfs' | 'legacy', source?: string) => {
    const key = mapPath(entry)
    const current = entries.get(key) ?? { ...entry, legacy: false, opfs: false }
    current[kind] = true
    if (source) current.source = source
    entries.set(key, current)
  }

  const listOpfs = async () => {
    try {
      const root = await (await getRoot()).getDirectoryHandle(ROOT_DIRECTORY)
      for await (const source of root.values()) {
        if (source.kind !== 'directory') continue
        const sourceKey = source.name
        for await (const map of source.values()) {
          if (map.kind !== 'directory' || !map.name.startsWith(MAP_PREFIX)) continue
          const code = decodeURIComponent(map.name.slice(MAP_PREFIX.length))
          mark(
            { sourceKey, code },
            'opfs',
            base && tileSourceKey(base) === sourceKey ? base : undefined,
          )
        }
      }
    } catch {
      // 浏览器可能只开放缓存存储，两个列表独立读取。
    }
  }

  const listCaches = async () => {
    const storage = globalThis.caches
    const keys = (await storage?.keys().catch(() => [])) ?? []
    const generic = await Promise.all(
      keys.map(async name => {
        const { name: logicalName } = CacheMeta.parse(name)
        if (!logicalName?.startsWith(LEGACY_PREFIX)) return name
        const code = logicalName.slice(LEGACY_PREFIX.length)
        if (name !== legacyCacheName(code)) return name

        try {
          const cache = await storage.open(name)
          let hasTileEntries = false
          let hasOtherEntries = false
          for (const request of await cache.keys()) {
            const tile = parseTileUrl(request.url)
            if (tile?.code === code) {
              hasTileEntries = true
              mark({ sourceKey: tileSourceKey(tile.base), code }, 'legacy', tile.base)
            } else {
              hasOtherEntries = true
            }
          }
          if (hasTileEntries || !hasOtherEntries) return
        } catch {
          // 无法列举内容时保留原来的按库清理入口。
        }
        return name
      }),
    )
    return generic.filter(name => name !== undefined)
  }

  const [, cacheKeys] = await Promise.all([listOpfs(), listCaches()])
  const tileCaches = [...entries.values()].sort(
    (a, b) => a.code.localeCompare(b.code) || a.sourceKey.localeCompare(b.sourceKey),
  )
  return { tileCaches, cacheKeys }
}
