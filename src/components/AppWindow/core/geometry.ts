import type { MapWindow } from '../types'

export const HEADER_HEIGHT = 30
export const DEFAULT_WINDOW_SIZE: MapWindow.Size = { width: 300, height: 300 }

interface WindowLayout {
  normalRect: MapWindow.Rect
  mode?: 'default' | 'maximize'
  collapsed: boolean
  foldedPosition?: MapWindow.Coordinate
  customized: boolean
}

export type { WindowLayout }

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export const getMinimumSize = (options: MapWindow.WindowOpenParams): MapWindow.Size => ({
  width: options.minWidth ?? DEFAULT_WINDOW_SIZE.width,
  height: options.minHeight ?? DEFAULT_WINDOW_SIZE.height,
})

export const constrainRect = (
  rect: MapWindow.Rect,
  bounds: MapWindow.Size,
  minimum: MapWindow.Size,
): MapWindow.Rect => {
  const width = clamp(rect.width, minimum.width, bounds.width)
  const height = clamp(rect.height, minimum.height, bounds.height)
  return {
    x: clamp(rect.x, 0, bounds.width - width),
    y: clamp(rect.y, 0, bounds.height - height),
    width,
    height,
  }
}

export const getInitialRect = (
  options: MapWindow.WindowOpenParams,
  bounds: MapWindow.Size,
): MapWindow.Rect => {
  const minimum = getMinimumSize(options)
  const width = Math.max(options.width ?? minimum.width, minimum.width)
  const height = Math.max(options.height ?? minimum.height, minimum.height)
  const spaceX = Math.max(0, bounds.width - width)
  const spaceY = Math.max(0, bounds.height - height)
  if (options.center) return { x: spaceX / 2, y: spaceY / 2, width, height }
  return {
    x: options.right === undefined ? (options.x ?? 0) : spaceX - options.right,
    y: options.bottom === undefined ? (options.y ?? 0) : spaceY - options.bottom,
    width,
    height,
  }
}

export const getDisplayRect = (
  layout: WindowLayout,
  bounds: MapWindow.Size,
  normal: MapWindow.Rect,
): MapWindow.Rect => {
  if (layout.collapsed) {
    const position = layout.foldedPosition ?? normal
    const header = { width: DEFAULT_WINDOW_SIZE.width, height: HEADER_HEIGHT }
    return constrainRect({ ...header, x: position.x, y: position.y }, bounds, header)
  }
  if (layout.mode === 'maximize') return { x: 0, y: 0, ...bounds }
  return normal
}

const resizeAxis = (
  start: number,
  length: number,
  delta: number,
  limit: number,
  minimum: number,
  fromStart: boolean,
): [start: number, length: number] => {
  const end = start + length
  if (fromStart) {
    const next = clamp(start + delta, 0, end - Math.min(minimum, end))
    return [next, end - next]
  }
  return [start, clamp(length + delta, minimum, limit - start)]
}

export const adjustRect = (
  rect: MapWindow.Rect,
  delta: MapWindow.Coordinate,
  operation: MapWindow.Operation,
  bounds: MapWindow.Size,
  minimum: MapWindow.Size,
): MapWindow.Rect => {
  if (operation === 'move') {
    return constrainRect({ ...rect, x: rect.x + delta.x, y: rect.y + delta.y }, bounds, rect)
  }

  const [x, width] = /[ew]/.test(operation)
    ? resizeAxis(rect.x, rect.width, delta.x, bounds.width, minimum.width, operation.includes('w'))
    : [rect.x, rect.width]
  const [y, height] = /[ns]/.test(operation)
    ? resizeAxis(
        rect.y,
        rect.height,
        delta.y,
        bounds.height,
        minimum.height,
        operation.includes('n'),
      )
    : [rect.y, rect.height]
  return { x, y, width, height }
}
