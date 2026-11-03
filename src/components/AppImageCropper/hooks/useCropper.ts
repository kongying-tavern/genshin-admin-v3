import type { AppImageCropperProps } from '../types'
import Konva from 'konva'
import { clamp } from 'lodash'
import { getObjectFitSize } from '@/utils'
import { loadKonvaImage } from '../utils'

export interface ImageInfoHookOptions {
  container: Ref<HTMLDivElement | undefined>
  props: ToRefDestructure<Required<AppImageCropperProps>>
  onCrop: (blob: Blob) => void
  onError: (err: Error) => void
}

export const useCropper = (options: ImageInfoHookOptions) => {
  const { container, props, onCrop, onError } = options

  const {
    image: imageSource,
    maxZoom,
    minZoom,
    fit,
    cropRatio,
    allowRotate,
    autoCrop,
    autoCropDebounce,
    autoCropOnImageLoaded,
  } = props

  const _stage = shallowRef<Konva.Stage>()
  const _layer = shallowRef<Konva.Layer>()
  const _image = shallowRef<Konva.Image>()

  const containerSize = ref({
    w: 0,
    h: 0,
  })

  const immediateCrop = async () => {
    const stage = _image.value?.getStage()
    if (!stage) return
    const blob = (await stage.toBlob({
      mimeType: 'image/png',
      pixelRatio: cropRatio.value,
    })) as Blob
    onCrop(blob)
    return blob
  }

  const debounceCrop = useDebounceFn(immediateCrop, autoCropDebounce)

  /** @alias */
  const crop = () => debounceCrop()

  const minScale = computed(() => {
    if (!_image.value) return 1
    const iw = _image.value.width()
    const ih = _image.value.height()
    const fitType = toValue(fit)
    const { w: cw, h: ch } = toValue(containerSize)
    const { radio } = getObjectFitSize(fitType, cw, ch, iw, ih)
    return minZoom.value === undefined ? radio : Math.max(radio, minZoom.value)
  })

  const maxScale = computed(() => {
    if (!_image.value || maxZoom.value === undefined) return 1
    return Math.max(minScale.value, 2 ** maxZoom.value)
  })

  const _getBouondingPosition = (_image: Konva.Image, pos: { x: number; y: number }) => {
    const _stage = _image.getStage()
    if (!_stage) return pos
    const { width: cw, height: ch } = _stage.size()
    const { width: rectW, height: rectH } = _image.getClientRect()
    return {
      x: rectW < cw ? cw / 2 : clamp(pos.x, -0.5 * rectW + cw, 0.5 * rectW),
      y: rectH < ch ? ch / 2 : clamp(pos.y, -0.5 * rectH + ch, 0.5 * rectH),
    }
  }

  const _attachDragController = (_image: Konva.Image) => {
    _image.dragBoundFunc(pos => _getBouondingPosition(_image, pos))
    _image.on('dragend', () => autoCrop.value && crop())
  }

  const _attachZoomController = (_image: Konva.Image) => {
    const _stage = _image.getStage()
    if (!_stage) return
    _stage.on('wheel', ev => {
      const currentScale = _image.scaleX()
      const newScale = clamp(
        currentScale * (1 - ev.evt.deltaY / 1000),
        minScale.value,
        maxScale.value,
      )

      const { width: cw, height: ch } = _stage.size()
      const { width: rectW, height: rectH, x: imgX, y: imgY } = _image.getClientRect()

      const center = {
        x: cw / 2,
        y: ch / 2,
      }

      // 计算中心点坐标到图片的相对距离
      const relative = {
        x: (center.x - imgX) / rectW,
        y: (center.y - imgY) / rectH,
      }

      // 计算缩放后尺寸
      const scaleSize = {
        w: newScale * (rectW / currentScale),
        h: newScale * (rectH / currentScale),
      }

      // 计算缩放后中心点位置
      const position = {
        x: center.x - scaleSize.w * relative.x + scaleSize.w / 2,
        y: center.y - scaleSize.h * relative.y + scaleSize.h / 2,
      }

      _image
        .scale({
          x: newScale,
          y: newScale,
        })
        .position(_getBouondingPosition(_image, position))
      autoCrop.value && crop()
    })
  }

  const _attachRotateController = (_image: Konva.Image) => {
    const _stage = _image.getStage()
    if (!_stage) return
    let tween: Konva.Tween | null = null
    _image.on('click', () => {
      if (tween || !allowRotate.value) return
      const { width: cw, height: ch } = _stage.size()
      const ro = _image.rotation() + 90
      tween = new Konva.Tween({
        node: _image,
        x: cw / 2,
        y: ch / 2,
        scaleX: minScale.value,
        scaleY: minScale.value,
        rotation: Math.trunc(ro / 90) * 90,
        duration: 0.15,
        easing: Konva.Easings.EaseOut,
      }).play()
      tween.onFinish = () => {
        tween?.destroy()
        tween = null
        autoCrop.value && crop()
      }
    })
  }

  const _resetImagePosition = (image?: Konva.Image) => {
    if (!image) return
    const layer = image.getLayer()
    if (!layer) return
    const { width: cw, height: ch } = layer.size()
    const { width, height } = image.size()
    const scale = minScale.value
    image
      .offset({ x: width / 2, y: height / 2 })
      .scale({ x: scale, y: scale })
      .position({ x: cw / 2, y: ch / 2 })
      .setDraggable(true)
  }

  const _loadImage = async (imageURL?: string) => {
    _image.value?.remove()
    if (!imageURL) return
    try {
      const image = await loadKonvaImage(imageURL)
      if (!image) throw new Error('无法加载文件')

      _image.value = image

      if (!_layer.value) throw new Error('无法获取图层实例')

      _layer.value.add(image)

      _resetImagePosition(image)

      autoCropOnImageLoaded.value && crop()
      _attachDragController(image)
      _attachZoomController(image)
      _attachRotateController(image)
    } catch (err) {
      onError(
        err instanceof Error ? err : new Error(err instanceof Event ? 'internal error' : `${err}`),
      )
    }
  }

  onMounted(async () => {
    if (!container.value) return
    const stage = new Konva.Stage({
      container: container.value,
    })
    const layer = new Konva.Layer()
    stage.add(layer)
    _stage.value = stage
    _layer.value = layer
  })

  onUnmounted(() => {
    _stage.value?.destroy()
  })

  useResizeObserver(
    container,
    ([
      {
        contentRect: { width: cw, height: ch },
      },
    ]) => {
      if (cw <= 0 || ch <= 0) return
      containerSize.value = { w: cw, h: ch }
      _stage.value?.size({ width: cw, height: ch })
      const image = toValue(_image)
      if (!image) return
      _resetImagePosition(image)
      autoCrop.value && crop()
    },
  )

  watch(imageSource, _loadImage, { immediate: true })

  watch(fit, () => {
    _resetImagePosition(_image.value)
    autoCrop.value && crop()
  })

  return {
    stage: _stage,
    layer: _layer,
    image: _image,
    minScale,
    maxScale,
    crop,
  }
}
