import type { CompositeLayerProps, Layer, LayersList, UpdateParameters } from 'deck.gl'
import type { GSTagLayerProps } from '../types'

import type { AreaTagTuple } from '@/configs'
import { CompositeLayer, ScatterplotLayer, TextLayer } from 'deck.gl'

const tagSizes = [12, 32, 48]

export const isAreaTagVisible = (level: number, zoom: number): boolean =>
  (level === 0 && zoom > -1.5) || (level === 1 && zoom <= -1.5) || (level === 2 && zoom <= -4)

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
    const editor = import.meta.env.AREA_TAG_EDITOR ? this.props.editor : undefined
    const { zoom } = this.context.viewport
    const [cx, cy] = offset
    const getPosition = ({ 1: [x, y] }: AreaTagTuple): DTO.Coordinate2D => [x + cx, y + cy]

    const createTextLayer = (id: string, data: AreaTagTuple[], level: number, draft = false) => {
      const opacity = draft || isAreaTagVisible(level, zoom) ? 255 : 0
      return new TextLayer<AreaTagTuple>({
        id: `${this.id}-${id}`,
        visible: visible && (!editor || opacity > 0),
        data,
        characterSet: 'auto',
        fontFamily,
        fontSettings: {
          buffer: 8,
          sdf: true,
        },
        sizeMinPixels: 13,
        sizeMaxPixels: 32,
        sizeScale: 2 ** (zoom + 2),
        outlineColor: [102, 102, 102, opacity],
        outlineWidth: 2,
        getColor: () => [255, 255, 255, opacity],
        getSize: tagSizes[level] ?? 16,
        getText: ({ 0: text }) => text,
        getPosition,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        updateTriggers: { getPosition: offset, getColor: opacity },
        transitions: { getColor: 100 },
        pickable: Boolean(editor),
        background: Boolean(editor),
        backgroundPadding: [3, 2],
        getBackgroundColor: draft ? [27, 35, 49, 210] : [0, 0, 0, 0],
        getBorderColor: [255, 216, 149, 255],
        getBorderWidth: draft ? 1 : 0,
      })
    }

    const layers: LayersList = tagGroups.map((tags, level) =>
      createTextLayer(String(level), tags, level),
    )
    if (editor?.draft) {
      const data = [editor.draft]
      layers.push(
        createTextLayer('draft', data, editor.draft[2] ?? 0, true),
        new ScatterplotLayer<AreaTagTuple>({
          id: `${this.id}-anchor`,
          visible,
          data,
          getPosition,
          radiusUnits: 'pixels',
          getRadius: 4,
          filled: false,
          stroked: true,
          lineWidthUnits: 'pixels',
          getLineWidth: 2,
          getLineColor: [255, 190, 90, 255],
          updateTriggers: { getPosition: offset },
        }),
      )
    }
    return layers
  }
}
