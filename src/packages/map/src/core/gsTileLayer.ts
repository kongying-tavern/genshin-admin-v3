import type { GSTileLayerProps } from '../types'
import type { TileData } from '../utils/tileSource'
import { BitmapLayer, TileLayer } from 'deck.gl'
import { getTileBounds } from '../utils/mapCoordinates'
import { loadTile } from '../utils/tileSource'

export class GSTileLayer extends TileLayer<TileData | null, GSTileLayerProps> {
  static layerName = 'GenshinTileLayer'

  constructor(props: GSTileLayerProps) {
    const { code, extension, size, tilesOffset = [0, 0] } = props
    const [[xmin, ymin], [xmax, ymax]] = getTileBounds(size, tilesOffset)

    super({
      // 保留底图参数，供上下文恢复时由 Layer.clone() 重建切片图层。
      ...props,
      id: `tile-layer-${code}`,
      data: undefined,
      tileSize: 256,
      minZoom: -3, // 固定值，对应服务端存储底图的 level 10
      maxZoom: 0, // 固定值，对应服务端存储底图的 level 13
      maxCacheByteSize: Number.MAX_SAFE_INTEGER,
      maxCacheSize: Number.MAX_SAFE_INTEGER,
      extent: [xmin, ymax, xmax, ymin],
      getTileData: ({ index, signal }) => loadTile(code, extension, index, signal),
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
