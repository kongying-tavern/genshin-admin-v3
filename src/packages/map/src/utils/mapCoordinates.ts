/** 将点位坐标平移到地图坐标系。 */
export const toMapCoordinate = (
  [x, y]: DTO.Coordinate2D,
  [ox, oy]: DTO.Coordinate2D,
): DTO.Coordinate2D => [x + ox, y + oy]

export const getTileBounds = (
  size: DTO.Coordinate2D,
  offset: DTO.Coordinate2D,
): DTO.OverlayBounds => [offset, toMapCoordinate(size, offset)]
