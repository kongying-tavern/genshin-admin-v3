/**
 * 计算图像在区域内的适应尺寸
 * @param type 适应模式，对应 object-fit 里的 cover 和 contain
 * @param containerWidth 容器宽
 * @param containerHeight 容器高
 * @param imgWidth 图像宽
 * @param imgHeight 图像高
 */
export const getObjectFitSize = (
  type: 'cover' | 'contain',
  containerWidth: number,
  containerHeight: number,
  imgWidth: number,
  imgHeight: number,
) => {
  let radio = 1 // 容器与图片的比例
  let sx = 0 // 开始剪切的 x 坐标位置。
  let sy = 0 // 开始剪切的 y 坐标位置。
  let sw = imgWidth // 被剪切图像的宽度。
  let sh = imgHeight // 被剪切图像的高度。
  let dx = 0 // 在画布上放置图像的 x 坐标位置。
  let dy = 0 // 在画布上放置图像的 y 坐标位置。
  let dw = containerWidth // 要使用的图像的宽度（伸展或缩小图像）。
  let dh = containerHeight // 要使用的图像的高度（伸展或缩小图像）。
  const cWHRatio = containerWidth / containerHeight
  const iWHRatio = imgWidth / imgHeight
  if (type === 'cover') {
    // cover模式，需要裁剪
    if (iWHRatio >= cWHRatio) {
      // 横图，高先匹配，裁剪宽度
      radio = containerHeight / imgHeight
      sx = (imgWidth - containerWidth / radio) / 2
      sw = containerWidth / radio
      sh = imgHeight
    } else {
      // 竖图，宽先匹配，裁剪高度
      radio = containerWidth / imgWidth
      sy = (imgHeight - containerHeight / radio) / 2
      sw = imgWidth
      sh = containerHeight / radio
    }
  } else if (type === 'contain') {
    if (iWHRatio >= cWHRatio) {
      // 横图，宽先匹配，高度自适应
      radio = containerWidth / imgWidth
      dy = (containerHeight - imgHeight * radio) / 2
      dh = imgHeight * radio
    } else {
      // 竖图，高先匹配，宽度自适应
      radio = containerHeight / imgHeight
      dx = (containerWidth - imgWidth * radio) / 2
      dw = imgWidth * radio
    }
  }
  return { sx, sy, sw, sh, dx, dy, dw, dh, radio }
}
