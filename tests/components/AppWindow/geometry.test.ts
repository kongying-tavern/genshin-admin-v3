import type { MapWindow } from '@/components/AppWindow/types'
import { expect, it } from 'vitest'
import { adjustRect } from '@/components/AppWindow/core/geometry'

const start = { x: 100, y: 80, width: 400, height: 240 }
const bounds = { width: 640, height: 360 }
const minimum = { width: 250, height: 160 }

it.each<[MapWindow.ResizeEdge, number, number, MapWindow.Rect]>([
  ['n', 0, 900, { x: 100, y: 160, width: 400, height: 160 }],
  ['ne', 900, 900, { x: 100, y: 160, width: 540, height: 160 }],
  ['e', 900, 0, { x: 100, y: 80, width: 540, height: 240 }],
  ['se', 900, 900, { x: 100, y: 80, width: 540, height: 280 }],
  ['s', 0, 900, { x: 100, y: 80, width: 400, height: 280 }],
  ['sw', 900, 900, { x: 250, y: 80, width: 250, height: 280 }],
  ['w', 900, 0, { x: 250, y: 80, width: 250, height: 240 }],
  ['nw', 900, 900, { x: 250, y: 160, width: 250, height: 160 }],
])('按 %s 方向缩放时固定对边并约束尺寸', (edge, x, y, expected) => {
  expect(adjustRect(start, { x, y }, edge, bounds, minimum)).toEqual(expected)
})
