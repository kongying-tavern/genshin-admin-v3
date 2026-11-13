import type {
  DeckProps,
  IconLayerProps,
  LayerProps,
  OrthographicView,
  OrthographicViewState,
} from 'deck.gl'
import type { AreaVo, MarkerLinkageVo, MarkerVo } from '@/api/alova/globals'
import type { AreaTagTuple } from '@/configs'

type OrthographicViewMapProps = DeckProps<OrthographicView>

// ============================== Map ==============================
export interface GenshinMapProps extends Omit<OrthographicViewMapProps, 'canvas'> {
  controller?: {
    dragPan?: boolean
    dragRotate?: boolean
    doubleClickZoom?: boolean
    touchZoom?: boolean
    touchRotate?: boolean
    keyboard?:
      | boolean
      | {
          zoomSpeed?: number
          moveSpeed?: number
          rotateSpeedX?: number
          rotateSpeedY?: number
        }
    dragMode?: 'pan' | 'rotate'
    inertia?: boolean | number
    scrollZoom?: {
      speed?: number
      smooth?: boolean
      transitionDuration?: number | (() => number)
    }
  }
}

// ============================== Layer ==============================
export interface GenshinMapViewState extends OrthographicViewState {
  target: [number, number]
  zoom: number
  minZoom?: number
  maxZoom?: number
}

export interface GSTileLayerProps {
  /** 底图标识 */
  code: string

  /** 图层尺寸 */
  size: [w: number, h: number]

  /**
   * 底图图片拓展名
   * @default 'png'
   */
  extension?: string

  /** 图元偏移量 */
  tilesOffset?: DTO.Coordinate2D
}

export interface GSTagLayerProps {
  /** 标签组 */
  tagGroups?: AreaTagTuple[][]

  /** 是否显示全部标签 */
  visible?: boolean

  /** 坐标偏移量 */
  offset?: DTO.Coordinate2D

  /** 字体 */
  fontFamily?: string
}

export interface GSOverlayerProps {
  /** 地图尺寸，用于设置 overlay 的 mask */
  bounds: [xmin: number, ymin: number, xmax: number, ymax: number]
  showOverlayMask?: boolean
  chunkMap: Map<string, OverlayChunk>
  normalChunks: string[]
  tileLikeChunks: string[]
  pickable?: boolean
}

export interface GSMarkerLayerProps {
  data: GSMarkerInfo[]
  /**
   * 数据区间更新描述（deck.gl 的 `_dataDiff`）
   *
   * 返回行区间时只重新计算并上传这些行的顶点属性，
   * 分片加载场景下可以把每条分片的 GPU 开销压到只与新增点位数量相关
   */
  _dataDiff?: LayerProps['_dataDiff']
  iconAtlas: IconLayerProps['iconAtlas']
  iconMapping: Required<IconLayerProps>['iconMapping']
  transparentMarked: boolean
  hoverMarkerIds?: Set<number>
  focusMarkerIds?: Set<number>
  markedMarkerIds?: Set<number>
  rewritePositions?: Map<number, DTO.Coordinate2D>
}

export interface ArrowShapeOptions {
  /** 箭体长度 @default 70 */
  arrowBodyLength?: number
  /** 箭体半径 @default 2 */
  arrowBodyRadius?: number
  /** 箭间距 @default 10 */
  arrowGap?: number
  /** 箭头半径 @default 10 */
  arrowHeadRadius?: number
  /** 箭头厚度 @default Math.SQRT2 * 4 */
  arrowHeadWeight?: number
  /** 箭头翼角（弧度） @default 0.75 * Math.PI */
  arrowWingAngle?: number
}

export interface GSLinkLayerProps extends ArrowShapeOptions {
  /** 关联数据 */
  data: {
    /** 关联连线的唯一 id */
    id: string
    /** 起始点 */
    from: DTO.Coordinate2D
    /** 终止点 */
    to: DTO.Coordinate2D
    /** 指示线（箭）的颜色 */
    color: [r: number, g: number, b: number]
  }[]
  /** 指示线的透明度 0-255 */
  colorOpacity?: number
  /** 描边宽度 */
  outlineWidth?: number
  /** 描边颜色 */
  outlineColor?: [r: number, g: number, b: number] | [r: number, g: number, b: number, a: number]
  /** hover 数据 */
  hoverIds?: Set<string>
  /** focus 数据 */
  focusIds?: Set<string>
  /** 缩放系数（不影响长度尺寸） */
  scale?: number
  /** 最大箭头数量 @default 100 */
  maxArrows?: number
}

// ============================== Marker ==============================
export interface GSMarkerInfo extends MarkerVo {
  /** 是否为快照 */
  __gs_isSnapshot?: boolean

  /** 用于渲染的附加属性，避免在渲染层进行计算 */
  render: {
    /** 点位坐标 */
    position: DTO.Coordinate2D

    /** 点位地区 */
    area: AreaVo

    /** 点位所属的底图 */
    tileCode: string

    /** 被渲染为主图标的物品 id */
    mainItemId: number

    /** 主图标 id */
    mainIconId: number

    /** 副图标 tag 列表 */
    restIconTags: string[]

    /** 副图标 id 列表 */
    restItemIds: number[]

    /** 是否为分层层级图标 */
    isUnderground: boolean

    /** 是否为临时点位 */
    isTemporary: boolean
  }
}

/** 点位关联 - 渲染单位 */
export interface MLRenderUnit {
  /** 关联唯一标识 */
  key: string
  /** 源点位 id */
  source: number
  /** 目标点位 id */
  target: number
  /** 关联类型标识 */
  type: string
}

/** 包含元信息的点位关联对象 */
export interface MarkerLinkMission extends MarkerLinkageVo {
  meta: {
    key: string
  }
}

/** 任务类型表 */
export interface MissionTypeMap {
  markerEditting: number | undefined
  markerDragging: Map<number, DTO.Coordinate2D>
  markerLink: MarkerLinkMission[]
  markerMultiSelect: string
  markerBulkState: boolean
  unknown: unknown
}

/** 混合任务类型 */
export type Mission = MapToSchema<MissionTypeMap>

/**
 * 临时点位类型表
 * @note value 只能为 `MarkerVo` 或 `MarkerWithRenderConfig`
 */
export interface TempMarkerTypeMap {
  focus: GSMarkerInfo[]
  markerLink: MarkerVo[]
  markerMultiSelect: GSMarkerInfo[]
  markerDragging: GSMarkerInfo[]
}

/** 临时点位类型 */
export type TempMarkerType = keyof TempMarkerTypeMap

/** 地图可用事件与其参数数组 */
export interface CustomEventTypeMap {
  unknown: unknown[]
}

// ============================== overlay ==============================

export interface OverlayGroup {
  id: string
  label?: DTO.OverlayGroupOption['label']
  value?: DTO.OverlayGroupOption['value']
  multiple: DTO.OverlayConfig['multiple']
  mask: DTO.OverlayConfig['overlayMask']
  url?: DTO.OverlayGroupOption['url']
  urlTemplate?: DTO.OverlayGroupOption['urlTemplate']
  bounds?: DTO.OverlayBounds
  items: DTO.OverlayOption[]
  role: DTO.OverlayRole
}

export interface OverlayUnit {
  id: string
  label?: string
  value?: string
  url?: DTO.OverlayOption['url']
  urlTemplate?: DTO.OverlayOption['urlTemplate']
  bounds?: DTO.OverlayBounds
}

export interface OverlayChunk {
  /** config 自身的唯一 id */
  id: string
  /** overlay 名称 */
  label: string
  /** overlay 所属的分组 */
  group: OverlayChunkGroup
  /** chunk 所属的单元 */
  item: {
    id: string
    name: string
  }
  /**
   * overlay 所属的地区代码
   * @note 一个层级可能存在于多个地区，所以使用 Set 类型进行存储
   */
  areaCodes: Set<string>
  /** overlay 图片地址 */
  url: string
  /** overlay 区域 */
  bounds: DTO.OverlayBounds
}

export interface OverlayChunkGroup {
  id: string
  name: string
  mask: boolean
  role: DTO.OverlayRole
  multiple: boolean
  areaCodes: Set<string>
  areaIndexes: Map<string, number>
}

export interface OverlayControlGroup extends OverlayChunkGroup {
  bounds: DTO.OverlayBounds
  items: { id: string; name: string }[]
}

export interface MergedOverlayGroups {
  [areaCode: string]: OverlayGroup[]
}

// ============================== event ==============================

export interface GSEventMap {
  setViewState: [state: Partial<GenshinMapViewState>]
}
