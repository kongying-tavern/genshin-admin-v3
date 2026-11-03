import Konva from 'konva'

export const loadKonvaImage = (url: string) =>
  new Promise<Konva.Image>((resolve, reject) =>
    Konva.Image.fromURL(
      url,
      image => resolve(image),
      error => reject(error),
    ),
  )
