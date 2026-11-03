/** 将 canvas 转换为 Blob */
export const toBlob = (canvas: HTMLCanvasElement, type = 'image/png') =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('序列化图像失败'))
      resolve(blob)
    }, type)
  })
