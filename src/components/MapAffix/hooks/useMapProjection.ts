import type { GenshinMapViewState } from '@/packages/map'
import { mapContainerHeightKey, mapContainerWidthKey, mapViewStateKey } from '@/shared'
import { useTileStore } from '@/stores'

export interface MapProjectionHookOptions {
  coord: DTO.Coordinate2D | Ref<DTO.Coordinate2D | undefined>
  noCovertCoord?: boolean | Ref<boolean>
  integer?: boolean | Ref<boolean>
}

export const useMapProjection = (options: MapProjectionHookOptions) => {
  const tileStore = useTileStore()

  const { coord, noCovertCoord = false, integer = false } = options

  const width = inject(mapContainerWidthKey, ref(0))
  const height = inject(mapContainerHeightKey, ref(0))
  const viewState = inject(
    mapViewStateKey,
    ref<GenshinMapViewState>({
      target: [0, 0],
      zoom: 0,
    }),
  )

  /** 投影后元素应随地图缩放等级所缩放的比例 */
  const scaleRatio = computed(() => 2 ** viewState.value.zoom)

  /** 视口中心坐标 */
  const center = computed<DTO.Coordinate2D>(() => [width.value / 2, height.value / 2])

  /** 投影后元素显示在视口上的坐标 */
  const position = computed<DTO.Coordinate2D>(() => {
    if (!tileStore.currentTileConfig) return [0, 0]
    const rawCoord = unref(coord)
    if (!rawCoord) return [0, 0]
    const [coordOffsetX, coordOffsetY] = unref(noCovertCoord)
      ? [0, 0]
      : tileStore.currentTileConfig.tile.center
    const { target, zoom } = viewState.value
    const scale = 2 ** zoom
    const [x, y] = rawCoord
    const [tx, ty] = target
    const lx = (x + coordOffsetX - tx) * scale
    const ly = (y + coordOffsetY - ty) * scale
    const [cx, cy] = center.value
    return unref(integer) ? [Math.floor(cx + lx), Math.floor(cy + ly)] : [cx + lx, cy + ly]
  })

  return {
    scaleRatio,
    position,
  }
}
