import type { GSMarkerInfo } from '@/packages/map'
import { ScatterplotLayer } from 'deck.gl'

export class MarkerIndicatorLayer extends ScatterplotLayer<GSMarkerInfo> {
  static layerName = 'GSMarkerIndicator'

  constructor(options: { id: string; data: GSMarkerInfo[] }) {
    super({
      id: 'marker-indicator',
      data: options.data,
      getPosition: info => info.render.position,
      getFillColor: [255, 140, 0],
      getRadius: 6,
      radiusMaxPixels: 6,
      radiusMinPixels: 6,
    })
  }
}
