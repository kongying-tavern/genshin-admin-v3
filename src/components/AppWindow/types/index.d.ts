import type { Component } from 'vue'

export declare namespace MapWindow {
  interface Coordinate {
    x: number
    y: number
  }

  interface Size {
    width: number
    height: number
  }

  interface Rect extends Coordinate, Size {}

  type SizeState = 'default' | 'maximize' | 'minimize'
  type InteractionState = 'default' | 'manual'
  type ResizeEdge = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
  type Operation = 'move' | ResizeEdge
  type RequestCloseReason = 'user' | 'completed' | 'preference'
  type DisposeReason = 'logout' | 'workspace' | 'owner' | 'permission' | 'mission'
  type CloseReason = RequestCloseReason | DisposeReason | 'cancelled' | 'openFailed'

  interface WindowOpenParams {
    id: string
    /** 业务 key 与运行实例 id 分开。 */
    key: string
    name: string
    icon?: Component
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
    x?: number
    y?: number
    right?: number
    bottom?: number
    center?: boolean
    sizeState?: SizeState
    enabled?: () => boolean
    beforeOpen?: () => boolean | Promise<boolean>
    beforeClose?: () => boolean | Promise<boolean>
    onClosed?: (reason: CloseReason) => void | Promise<void>
  }

  interface Info {
    readonly id: string
    readonly key: string
    readonly generation: number
    readonly name: string
    readonly icon?: Component
    readonly normalRect: Readonly<Rect>
    readonly displayRect: Readonly<Rect>
    readonly minimum: Readonly<Size>
    readonly sizeState?: SizeState
    readonly interactionState?: InteractionState
  }

  interface Summary {
    id: string
    name: string
    sizeState?: SizeState
    interactionState?: InteractionState
    order: number
    size: Size
    translate: Coordinate
  }

  interface Reader {
    list: () => Summary[]
    names: () => string[]
  }
}
