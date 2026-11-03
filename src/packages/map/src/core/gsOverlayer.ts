import type { LayersList } from 'deck.gl'
import type { GSOverlayerProps } from '../types'

import { BitmapLayer, CompositeLayer, SolidPolygonLayer } from 'deck.gl'

/** 拖拽指示线图层 */
export class GSOverlayer extends CompositeLayer<GSOverlayerProps> {
  static layerName = 'GenshinOverlayer'

  constructor(props: GSOverlayerProps) {
    super({
      id: 'genshin-overlayer',
      ...props,
    })
  }

  renderLayers = (): LayersList => {
    const { bounds, showOverlayMask, chunkMap, normalChunks, tileLikeChunks } = this.props

    const [xmin, ymin, xmax, ymax] = bounds

    return [
      tileLikeChunks.map(chunkId => {
        const {
          id,
          url,
          bounds: [[xmin, ymin], [xmax, ymax]],
        } = chunkMap.get(chunkId)!
        return new BitmapLayer({
          pickable: this.props.pickable,
          id,
          bounds: [xmin, ymax, xmax, ymin],
          image: url,
        })
      }),
      new SolidPolygonLayer({
        id: 'genshin-overlay-mask',
        data: [
          {
            polygon: [
              [xmin, ymin],
              [xmax, ymin],
              [xmax, ymax],
              [xmin, ymax],
            ],
          },
        ],
        getFillColor: () => [0, 0, 0, showOverlayMask ? 0.5 * 255 : 0],
        updateTriggers: {
          getFillColor: showOverlayMask,
        },
        transitions: {
          getFillColor: 100,
        },
      }),
      normalChunks.map(chunkId => {
        const {
          id,
          url,
          bounds: [[xmin, ymin], [xmax, ymax]],
        } = chunkMap.get(chunkId)!
        return new BitmapLayer({
          pickable: this.props.pickable,
          id,
          bounds: [xmin, ymax, xmax, ymin],
          image: url,
        })
      }),
    ]
  }
}
