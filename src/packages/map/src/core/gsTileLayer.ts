import type { GSTileLayerProps } from '../types'
import { BitmapLayer, TileLayer } from 'deck.gl'

interface TileData {
  byteLength: number
  image: ImageBitmap
  url: string
}

/** tiles 前缀地址 */
const BASE_URL = import.meta.env.VITE_ASSETS_BASE

/** 地图 zoom 为 0 时对应服务器资源的实际 zoom 值 */
const ZOOM_MAPPING = 13

export class GSTileLayer extends TileLayer<TileData | null> {
  static layerName = 'GenshinTileLayer'

  constructor(props: GSTileLayerProps) {
    const {
      code,
      extension = 'png',
      size: [w, h],
      tilesOffset: [ox, oy] = [0, 0],
    } = props

    super({
      id: `tile-layer-${code}`,
      data: undefined,
      tileSize: 256,
      minZoom: -3, // 固定值，对应服务端存储底图的 level 10
      maxZoom: 0, // 固定值，对应服务端存储底图的 level 13
      maxCacheByteSize: Number.MAX_SAFE_INTEGER,
      maxCacheSize: Number.MAX_SAFE_INTEGER,
      extent: [ox, h + oy, w + ox, oy],
      getTileData: async ({ index: { x, y, z }, signal }) => {
        try {
          if (signal?.aborted) return null
          const url = `${BASE_URL}/tiles_${code}/${z + ZOOM_MAPPING}/${x}_${y}.${extension}`
          const blob = await fetch(url, { mode: 'cors' }).then(res => res.blob())
          const image = await createImageBitmap(blob)
          return {
            byteLength: blob.size,
            image,
            url,
          }
        } catch {
          return null
        }
      },
      renderSubLayers: props => {
        if (!props.data) return null
        const { url, image } = props.data
        const [[xmin, ymin], [xmax, ymax]] = props.tile.boundingBox
        return new BitmapLayer({
          id: url,
          image,
          bounds: [xmin, ymax, xmax, ymin],
        })
      },
    })
  }
}
