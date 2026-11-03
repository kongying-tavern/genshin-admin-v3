import type { CompositeLayerProps, Layer, LayersList, UpdateParameters } from 'deck.gl'
import type { GSTagLayerProps } from '../types'

import type { AreaTagTuple } from '@/configs'
import { CompositeLayer, TextLayer } from 'deck.gl'

export class GSTagLayer extends CompositeLayer<GSTagLayerProps> {
  static layerName = 'GenshinTagLayer'

  constructor(props: GSTagLayerProps) {
    super({
      id: 'genshin-tag-layer',
      ...props,
    })
  }

  shouldUpdateState(
    params: UpdateParameters<Layer<GSTagLayerProps & Required<CompositeLayerProps>>>,
  ): boolean {
    const { propsChanged, viewportChanged } = params.changeFlags
    return Boolean(propsChanged) || viewportChanged
  }

  renderLayers = (): LayersList => {
    const { tagGroups = [], visible = true, offset = [0, 0], fontFamily } = this.props
    const { zoom } = this.context.viewport
    const [cx, cy] = offset

    const getTagOpacity = (level: number) =>
      ({
        0: zoom > -1.5,
        1: zoom <= -1.5,
        2: zoom <= -4,
      })[level]
        ? 255
        : 0

    const getTagSize = (level: number) =>
      ({
        0: 12,
        1: 32,
        2: 48,
      })[level] ?? 16

    return tagGroups.map(
      (tags, level) =>
        new TextLayer<AreaTagTuple>({
          id: `genshin-tag-layer-${level}`,
          visible,
          data: tags,
          characterSet: 'auto',
          fontFamily,
          fontSettings: {
            buffer: 8,
            sdf: true,
          },
          sizeMinPixels: 13,
          sizeMaxPixels: 32,
          sizeScale: 2 ** (zoom + 2),
          outlineColor: [102, 102, 102, getTagOpacity(level)],
          outlineWidth: 2,
          getColor: ({ 2: level = 0 }) => [255, 255, 255, getTagOpacity(level)],
          getSize: ({ 2: level = 0 }) => getTagSize(level),
          getText: ({ 0: text }) => text,
          getPosition: ({ 1: [x, y] }) => [x + cx, y + cy],
          updateTriggers: {
            getColor: zoom,
            outlineColor: zoom,
          },
          transitions: {
            getColor: 100,
          },
        }),
    )
  }
}
