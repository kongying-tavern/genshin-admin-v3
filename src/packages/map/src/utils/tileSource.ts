import { isCacheableTileResponse, openTileCache } from './tileCache'
import { tileCacheAllowed, tileCacheEpoch } from './tileServiceWorker'
import { normalizeTileBase, tileUrl } from './tileUrl'

const ZOOM_MAPPING = 13

interface TileIndex {
  x: number
  y: number
  z: number
}

export interface TileData {
  byteLength: number
  image: ImageBitmap
  url: string
}

const fetchTile = (url: string, signal?: AbortSignal) =>
  fetch(url, { mode: 'cors', signal, cache: 'no-cache' })

const finishTile = (tile: TileData | null, usable: () => boolean) => {
  if (usable()) return tile
  tile?.image.close()
  return null
}

const decodeTile = async (url: string, blob: Blob, active: () => boolean) => {
  if (!blob.size || !active()) return null
  try {
    const image = await createImageBitmap(blob)
    return finishTile({ url, image, byteLength: blob.size }, active)
  } catch {
    return null
  }
}

export const createTileSource = (assetsBase: string) => {
  const trailingSlashes = assetsBase?.trim().split(/[?#]/, 1)[0].match(/\/+$/)?.[0]
  let base: string | undefined

  return async (
    code: string,
    extension: string | undefined,
    { x, y, z }: TileIndex,
    signal?: AbortSignal,
  ): Promise<TileData | null> => {
    const active = () => !signal?.aborted
    if (!active()) return null

    try {
      base ??= normalizeTileBase(assetsBase)
      const level = z + ZOOM_MAPPING
      const fileExtension = extension ?? 'png'
      const url = tileUrl(base, code, level, x, y, fileExtension)

      // 旧版控制器仍负责在线读取，切换期间也不能把其响应写回 OPFS。
      const alternateLegacyUrl = trailingSlashes
        ? tileUrl(base + trailingSlashes, code, level, x, y, fileExtension)
        : undefined
      const cache = tileCacheAllowed()
        ? openTileCache({ base, code, level, url, alternateLegacyUrl })
        : null
      const epoch = tileCacheEpoch()
      const canUseCache = () => active() && tileCacheEpoch() === epoch && tileCacheAllowed()

      if (cache) {
        const current = () => canUseCache() && cache.current()
        const local = await cache.read()
        if (local) {
          const tile = await decodeTile(url, local, current)
          if (tile) return tile
          // 坏文件直接回源，避免从旧库恢复旧图片。
        } else if (current()) {
          const legacy = await cache.readLegacy()
          const tile = legacy && (await decodeTile(url, legacy.blob, current))
          if (legacy && tile) {
            await cache.write(legacy.blob, canUseCache, legacy.legacyUrl)
            const migrated = finishTile(tile, current)
            if (migrated) return migrated
          }
        }
      }

      if (!active()) return null
      const response = await fetchTile(url, signal)
      const blob = await response.blob()
      const tile = await decodeTile(url, blob, active)
      if (tile && cache && isCacheableTileResponse(response)) {
        await cache.write(blob, canUseCache)
      }
      return finishTile(tile, active)
    } catch {
      return null
    }
  }
}

export const loadTile = createTileSource(import.meta.env.VITE_ASSETS_BASE)
