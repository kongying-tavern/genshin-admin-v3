import { clamp } from '@vueuse/core'

export type PlacementAxis = 0 | 1

export const directionBadgeSize = 36

interface PlacementDirection {
  x: number
  y: number
  edge: 'left' | 'right' | 'top' | 'bottom'
  angle: number
}

export const getPlacementDirection = (
  [x, y]: DTO.Coordinate2D,
  [width, height]: DTO.Coordinate2D,
): PlacementDirection | undefined => {
  if (width <= 0 || height <= 0) return

  const centerX = width / 2
  const centerY = height / 2
  const dx = x - centerX
  const dy = y - centerY
  const intersectionX = dx === 0 ? Infinity : centerX / Math.abs(dx)
  const intersectionY = dy === 0 ? Infinity : centerY / Math.abs(dy)
  const intersection = Math.min(intersectionX, intersectionY)
  if (intersection >= 1) return

  const inset = directionBadgeSize / 2 + 6
  const insetX = Math.min(inset, centerX)
  const insetY = Math.min(inset, centerY)
  const badgeX = clamp(centerX + dx * intersection, insetX, width - insetX)
  const badgeY = clamp(centerY + dy * intersection, insetY, height - insetY)
  const edge =
    intersectionX <= intersectionY ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom'
  // 先用射线确定视口边缘，再从留出边距后的徽记位置指向真实瞄准点。
  const angle = (Math.atan2(y - badgeY, x - badgeX) * 180) / Math.PI + 90

  return { x: badgeX, y: badgeY, edge, angle }
}
