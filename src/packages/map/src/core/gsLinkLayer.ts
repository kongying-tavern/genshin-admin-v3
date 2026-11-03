import type {
  CompositeLayerProps,
  GetPickingInfoParams,
  Layer,
  PickingInfo,
  UpdateParameters,
} from 'deck.gl'

import type { ArrowShapeOptions, GSLinkLayerProps } from '../types'
import { CompositeLayer, LineLayer, PolygonLayer } from 'deck.gl'

/** 此处再包一层是避免 viewPort 变化时重新进行昂贵的顶点计算 */
class LinkLayerContent extends CompositeLayer<GSLinkLayerProps> {
  static layerName = 'LinkLayerContent'

  shouldUpdateState(params: UpdateParameters<Layer>): boolean {
    const { propsOrDataChanged } = params.changeFlags
    return propsOrDataChanged
  }

  /** 计算两点间箭头图元总数、坐标偏移量和旋转角 */
  calculateArrowLayout = (
    xa: number,
    ya: number,
    xb: number,
    yb: number,
    arrowLength: number,
    gap: number,
    maxArrows: number = 100,
  ) => {
    const unitLength = arrowLength + gap
    const dx = xb - xa
    const dy = yb - ya
    const length = Math.sqrt(dx ** 2 + dy ** 2)
    const angle = Math.atan2(dy, dx)
    if (length + gap <= unitLength) return { n: 1, ox: 0, oy: 0, angle, realUnitLength: length }
    let n = Math.floor((length + gap) / (arrowLength + gap))
    // 限制最大箭头数量，避免因连线过长达到绘制上限导致箭头消失
    if (n > maxArrows) {
      n = maxArrows
    }
    const realUnitLength = (length - n * gap) / n + gap
    const ox = realUnitLength * Math.cos(angle)
    const oy = realUnitLength * Math.sin(angle)
    return { n, ox, oy, angle, realUnitLength }
  }

  /** 计算箭头模板点集 */
  calculateArrowTemplate = (angle: number, params: Required<ArrowShapeOptions>) => {
    const {
      arrowBodyLength: abl,
      arrowBodyRadius: abr,
      arrowHeadRadius: ahr,
      arrowHeadWeight: ahw,
      arrowWingAngle: awa,
    } = params

    const cosAngle = Math.cos(angle)
    const sinAngle = Math.sin(angle)

    /** 当前设计共 10 个顶点 */
    const pointCount = 10

    const points = new Float64Array(pointCount * 2)

    // p1
    // const p1: Position = [abr, 0]
    points[0 * 2 + 0] = abr
    points[0 * 2 + 1] = 0

    // p2
    // const p2: Position = [0, -abr]
    points[1 * 2 + 0] = 0
    points[1 * 2 + 1] = -abr

    // p10
    // const p10: Position = [0, abr]
    points[9 * 2 + 0] = 0
    points[9 * 2 + 1] = abr

    // p6
    // const p6: Position = [abl + ahr, 0]
    points[5 * 2 + 0] = abl + ahr
    points[5 * 2 + 1] = 0

    // const pc: Position = [points[5 * 2 + 0] - Math.SQRT2 * Math.sin(awa) * ahw, 0]

    // p3
    // const p3: Position = [pc[0] - abr, -abr]
    points[2 * 2 + 0] = points[5 * 2 + 0] - Math.SQRT2 * Math.sin(awa) * ahw - abr
    points[2 * 2 + 1] = -abr

    // p9
    // const p9: Position = [p3[0], abr]
    points[8 * 2 + 0] = points[2 * 2 + 0]
    points[8 * 2 + 1] = abr

    // p5
    // const p5: Position = [abl, -ahr]
    points[4 * 2 + 0] = abl
    points[4 * 2 + 1] = -ahr

    // p4
    const p4Angle = 1.75 * Math.PI - awa
    // const p4: Position = [p5[0] + ahw * Math.cos(p4Angle), p5[1] - ahw * Math.sin(p4Angle)]
    points[3 * 2 + 0] = points[4 * 2 + 0] + ahw * Math.cos(p4Angle)
    points[3 * 2 + 1] = points[4 * 2 + 1] - ahw * Math.sin(p4Angle)

    // p7
    // const p7: Position = [abl, ahr]
    points[6 * 2 + 0] = abl
    points[6 * 2 + 1] = ahr

    // p8
    const p8Angle = 0.25 * Math.PI + awa
    // const p8: Position = [p7[0] + ahw * Math.cos(p8Angle), p7[1] - ahw * Math.sin(p8Angle)]
    points[7 * 2 + 0] = points[6 * 2 + 0] + ahw * Math.cos(p8Angle)
    points[7 * 2 + 1] = points[6 * 2 + 1] - ahw * Math.sin(p8Angle)

    // 旋转图形
    // const points = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10].map(({ 0: x, 1: y }) => {
    //   return [x * cosAngle - y * sinAngle, x * sinAngle + y * cosAngle] as Position
    // })
    for (let i = 0; i < pointCount; i++) {
      const ix = i * 2
      const iy = i * 2 + 1
      const x = points[ix]
      const y = points[iy]
      points[ix] = x * cosAngle - y * sinAngle
      points[iy] = x * sinAngle + y * cosAngle
    }

    return { points, pointCount }
  }

  getPickingInfo({ info }: GetPickingInfoParams): PickingInfo {
    const object = !info.sourceLayer
      ? undefined
      : 'index' in info.sourceLayer.props
        ? this.props.data[info.sourceLayer.props.index as number]
        : undefined
    return {
      ...info,
      object,
    }
  }

  renderLayers = () => {
    const {
      arrowBodyLength = 70,
      arrowBodyRadius = 2,
      arrowGap = 10,
      arrowHeadRadius = 10,
      arrowHeadWeight = Math.SQRT2 * 4,
      arrowWingAngle = 0.75 * Math.PI,
      outlineColor = [255, 255, 255],
      outlineWidth = 2,
      scale = 1,
      colorOpacity: opacity = 255,
      maxArrows = 100,
    } = this.props

    const abl = arrowBodyLength
    const abr = arrowBodyRadius * scale
    const gap = arrowGap * scale
    const ahr = arrowHeadRadius * scale
    const ahw = arrowHeadWeight * scale
    const awa = arrowWingAngle

    return this.props.data.map((info, layerIndex) => {
      const { 0: xa, 1: ya } = info.from
      const { 0: xb, 1: yb } = info.to
      const { realUnitLength, angle, n, ox, oy } = this.calculateArrowLayout(
        xa,
        ya,
        xb,
        yb,
        abl + ahr,
        gap,
        maxArrows,
      )
      const { points, pointCount } = this.calculateArrowTemplate(angle, {
        arrowBodyLength: realUnitLength - gap,
        arrowBodyRadius: abr,
        arrowGap: gap,
        arrowHeadRadius: ahr,
        arrowHeadWeight: ahw,
        arrowWingAngle: awa,
      })

      const data = new Uint8Array(n)
      for (let i = 0; i < n; i++) data[i] = i

      return new PolygonLayer<number, { index: number }>({
        id: this.props.id ? `link-layer-${layerIndex}-${this.props.id}` : undefined,
        index: layerIndex,
        pickable: true,
        data,
        positionFormat: 'XY',
        getPolygon: i => {
          const newPoints = new Float64Array(points.length)
          for (let p = 0; p < pointCount; p++) {
            newPoints[p * 2] = points[p * 2] + xa + i * ox
            newPoints[p * 2 + 1] = points[p * 2 + 1] + ya + i * oy
          }
          return newPoints
        },
        getFillColor: [...info.color, opacity],
        getLineColor: outlineColor,
        lineWidthMaxPixels: outlineWidth,
        lineWidthMinPixels: 0,
        updateTriggers: {
          getPolygon: scale,
          getFillColor: opacity,
        },
      })
    })
  }
}

/** 关联连线图层 */
export class GSLinkLayer extends CompositeLayer<GSLinkLayerProps> {
  static layerName = 'GSLinkLayer'

  constructor(props: Partial<GSLinkLayerProps & Required<CompositeLayerProps>>) {
    super({
      ...props,
      pickable: true,
    })
  }

  shouldUpdateState(params: UpdateParameters<Layer>): boolean {
    const { propsOrDataChanged, viewportChanged } = params.changeFlags
    return propsOrDataChanged || viewportChanged
  }

  renderLayers = () => {
    const { zoom } = this.context.viewport
    const { arrowHeadRadius = 10, hoverIds, focusIds } = this.props
    const scale = 2 ** -Math.max(0, zoom)

    return [
      // focus
      new LineLayer<GSLinkLayerProps['data'][number]>({
        id: this.props.id ? `link-focus-${this.props.id}` : undefined,
        pickable: true,
        data: this.props.data,
        getSourcePosition: info => info.from,
        getTargetPosition: info => info.to,
        getWidth: arrowHeadRadius,
        widthScale: scale * 2 ** (zoom + 1),
        getColor: info => {
          return [255, 255, 0, focusIds?.has(info.id) ? 80 : 0]
        },
        widthMinPixels: 0,
        updateTriggers: {
          getWidth: zoom,
          getColor: focusIds,
        },
      }),

      // content
      new LinkLayerContent({
        ...this.props,
        data: this.props.data,
        id: this.props.id ? `link-content-${this.props.id}` : undefined,
        scale,
      }),

      // hover
      new LineLayer<GSLinkLayerProps['data'][number]>({
        id: this.props.id ? `link-hover-${this.props.id}` : undefined,
        pickable: true,
        data: this.props.data,
        getSourcePosition: info => info.from,
        getTargetPosition: info => info.to,
        getWidth: arrowHeadRadius,
        widthScale: scale * 2 ** (zoom + 1),
        getColor: info => {
          const { 0: r, 1: g, 2: b } = info.color
          return [r, g, b, focusIds?.has(info.id) || !hoverIds?.has(info.id) ? 0 : 80]
        },
        widthMinPixels: 0,
        updateTriggers: {
          getWidth: zoom,
          getColor: hoverIds,
        },
      }),
    ]
  }
}
