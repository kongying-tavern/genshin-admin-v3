import type { Unsubscribable } from 'rxjs'
import type { ShallowRef } from 'vue'
import type { IconVariant } from '@/pages/pageIconManager/types'
import { clamp } from '@vueuse/core'
import Konva from 'konva'
import { getObjectFitSize } from '@/utils'

const config = {
  anchorFill: '#FFF',
  anchorStroke: '#00CCFF',
}

/**
 * ### 图像裁切器 hook
 * - 确保在 `ready` 之后才调用相关 api
 */
export const useImageCropper = (
  containerRef: ShallowRef<HTMLDivElement | undefined>,
  options: ImageCropperOptions = {},
) => {
  const { disabled = false, variant = 'default', keepRatio = true } = options

  /** 裁切器是否已经初始化完毕 */
  const { resolve, promise: ready } = Promise.withResolvers<Konva.Stage>()

  /** 裁切器上下文 */
  const context = {
    /** 场景 */
    stage: shallowRef<Konva.Stage | null>(null),
    /** 图层 */
    layer: shallowRef<Konva.Layer | null>(null),
    /** 图片 */
    image: shallowRef<Konva.Image | null>(null),
    /** 控件 */
    transformer: shallowRef<Konva.Transformer | null>(null),
    /** 选区矩形 */
    rect: shallowRef<Konva.Rect | null>(null),
    /** 渲染回调 */
    animationFrame: shallowRef(-1),
    /** 内部事件处理器 */
    subscriptions: [] as Unsubscribable[],
  }

  /** 图片加载 hook */
  const imageHook = createEventHook<{
    variant: IconVariant
    bmp: ImageBitmap
    blob: Blob
    isRaw: boolean
  }>()
  /** 错误处理 hook */
  const errorHook = createEventHook<Error>()
  /** 渲染处理 hook */
  const frameHook = createEventHook<{
    stage: Konva.Stage
    image: Konva.Image
    rect: Konva.Rect
    circle: boolean
  }>()

  /** 错误捕获 */
  const catchError = (err: unknown) => {
    if (err instanceof Error) {
      if (err.name === 'AbortError') return
      errorHook.trigger(err)
    }
    const error = new Error(typeof err === 'string' ? err : JSON.stringify(err))
    errorHook.trigger(error)
  }

  /** 关闭 ImageBitmap 释放 GPU 内存 */
  const closeImageBitmap = (img: Konva.Image | null) => {
    if (!img) return
    const bmp = img.image()
    if (bmp && typeof (bmp as ImageBitmap).close === 'function') {
      try {
        ;(bmp as ImageBitmap).close()
      } catch {
        // 忽略关闭错误
      }
    }
  }

  /** 清除裁切器 */
  const destory = () => {
    if (!context.stage.value) return
    // 先关闭 ImageBitmap 释放资源
    closeImageBitmap(context.image.value)
    // 取消动画帧
    if (context.animationFrame.value !== -1) {
      cancelAnimationFrame(context.animationFrame.value)
      context.animationFrame.value = -1
    }
    context.subscriptions.forEach(({ unsubscribe }) => unsubscribe())
    context.subscriptions = []
    context.stage.value.destroy()
    context.stage.value = null
    context.image.value = null
    context.layer.value = null
    context.transformer.value = null
    context.rect.value = null
  }

  /** 初始化裁切器 */
  const setup = (div: HTMLDivElement) => {
    const stage = new Konva.Stage({
      container: div,
      width: div.clientWidth,
      height: div.clientHeight,
      listening: !toValue(disabled),
    })
    const resizeOb = new ResizeObserver(() => {
      const { clientWidth: cw, clientHeight: ch } = div
      stage.width(cw)
      stage.height(ch)
    })
    resizeOb.observe(div)
    context.subscriptions.push({
      unsubscribe: () => resizeOb.disconnect(),
    })
    context.stage.value = stage
    resolve(stage)
  }

  /** 将加载的图片装载为图层 */
  const setupLayer = (bmp: ImageBitmap) => {
    const stage = context.stage.value
    if (!stage) throw new Error('裁切器未初始化')
    // 先关闭旧的 ImageBitmap 释放 GPU 内存
    closeImageBitmap(context.image.value)
    if (context.layer.value) {
      context.layer.value.destroy()
      context.layer.value = null
      context.transformer.value = null
    }
    const { width: cw, height: ch } = stage.getSize()
    const { dx, dy, dw, dh } = getObjectFitSize('contain', cw, ch, bmp.width, bmp.height)
    // 创建图层
    const layer = new Konva.Layer()
    // 创建图片层
    const image = new Konva.Image({
      image: bmp,
      x: dx,
      y: dy,
      width: dw,
      height: dh,
      draggable: true,
    })
    context.image.value = image
    layer.add(image)
    // 创建选区
    const rectSize = Math.min(dw, dh)
    const rect = new Konva.Rect({
      x: dx,
      y: dy,
      width: rectSize,
      height: rectSize,
      draggable: true,
      dragBoundFunc({ x, y }) {
        const { width: w, height: h } = this.getClientRect()
        const { x: dx, y: dy, width: dw, height: dh } = image.getClientRect()
        return {
          x: Math.round(clamp(x, dx, dx + dw - w)),
          y: Math.round(clamp(y, dy, dy + dh - h)),
        }
      },
    })
    const isDisabled = toValue(disabled)
    // 创建变换器
    const tr = new Konva.Transformer({
      nodes: [rect],
      rotateEnabled: false,
      keepRatio: toValue(keepRatio),
      borderStroke: isDisabled ? 'transparent' : config.anchorStroke,
      anchorFill: isDisabled ? 'transparent' : config.anchorFill,
      anchorStroke: isDisabled ? 'transparent' : config.anchorStroke,
      anchorSize: 6,
      boundBoxFunc: ({ width: ow, height: oh }, { x, y, width: w, height: h }) => {
        const { x: dx, y: dy, width: dw, height: dh } = image.getClientRect()
        const newW = Math.round(clamp(w, 32, dw))
        const newH = Math.round(clamp(h, 32, dh))
        const keep = toValue(keepRatio)
        const outW = keep ? Math.min(newW, newH) : newW
        const outH = keep ? Math.min(newW, newH) : newH
        const rect = {
          x: Math.round(clamp(x, dx, dx + dw - ow)),
          y: Math.round(clamp(y, dy, dy + dh - oh)),
          width: outW,
          height: outH,
          rotation: 0,
        }
        return rect
      },
    })
    context.transformer.value = tr
    // 交互样式
    rect.on('mouseover', () => {
      rect.fill('#00CCFF20')
      stage.getStage().container().style.cursor = 'move'
    })
    rect.on('mouseout', () => {
      rect.fill('transparent')
      stage.getStage().container().style.cursor = 'default'
    })
    layer.add(rect)
    layer.add(tr)
    // 添加到场景
    stage.add(layer)
    context.layer.value = layer
    context.rect.value = rect

    // 基于 rAF 的渲染循环
    const renderLoop = () => {
      const stage = context.stage.value
      const image = context.image.value
      const rect = context.rect.value
      if (stage && image && rect) {
        frameHook.trigger({
          stage,
          rect,
          image,
          circle: false,
        })
      }
      context.animationFrame.value = requestAnimationFrame(renderLoop)
    }

    // 启动渲染循环
    if (context.animationFrame.value !== -1) {
      cancelAnimationFrame(context.animationFrame.value)
    }
    context.animationFrame.value = requestAnimationFrame(renderLoop)

    // 清理渲染循环
    context.subscriptions.push({
      unsubscribe: () => {
        if (context.animationFrame.value !== -1) {
          cancelAnimationFrame(context.animationFrame.value)
          context.animationFrame.value = -1
        }
      },
    })
  }

  if (isRef(disabled)) {
    watch(disabled, v => {
      const stage = context.stage.value
      if (stage) stage.listening(!v)
      const transformer = context.transformer.value
      if (transformer) {
        transformer.anchorFill(v ? 'transparent' : config.anchorFill)
        transformer.anchorStroke(v ? 'transparent' : config.anchorStroke)
        transformer.borderStroke(v ? 'transparent' : config.anchorStroke)
      }
    })
  }

  if (isRef(keepRatio)) {
    watch(keepRatio, v => {
      const transformer = context.transformer.value
      const rect = context.rect.value
      const image = context.image.value
      if (!transformer || !rect || !image) return
      transformer.keepRatio(v)
      if (v) {
        // 开启时将选区收敛为正方形，保持 1:1 语义
        const { x: ix, y: iy, width: iw, height: ih } = image.getClientRect()
        const size = Math.min(rect.width(), rect.height())
        const nx = Math.round(clamp(rect.x(), ix, ix + iw - size))
        const ny = Math.round(clamp(rect.y(), iy, iy + ih - size))
        rect.setAttrs({ x: nx, y: ny, width: size, height: size })
        transformer.forceUpdate()
      }
    })
  }

  /** 从文件选择器加载图片 */
  const loadFromFile = async (isRaw = false) => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            accept: {
              'image/*': ['.png', '.jpg', '.jpeg', '.bmp', '.webp'],
            },
          },
        ],
      })
      const file = await handle.getFile()
      const bmp = await createImageBitmap(file)
      setupLayer(bmp)
      imageHook.trigger({
        bmp,
        blob: file,
        isRaw,
        variant: toValue(variant),
      })
    } catch (err) {
      catchError(err)
    }
  }

  /** 异步操作取消/中断的控制器 */
  const loadController = shallowRef<AbortController | null>(null)

  /** 从非本地源加载图片 */
  const loadFromSrc = async (
    /** 图源 */
    src: string | Blob | ArrayBuffer,
    options: {
      /** 是否为原始图片 */
      isRaw?: boolean
      /** 使用二进制源时指定图片的 MIME 类型 @default 'image/png' */
      type?: string
    } = {},
  ) => {
    const { isRaw = false, type = 'image/png' } = options
    try {
      loadController.value?.abort('Image Source Changed')
      const ac = new AbortController()
      loadController.value = ac
      // 加载图片
      const blob = await (async () => {
        if (src instanceof Blob) return src
        if (src instanceof ArrayBuffer) return new Blob([src], { type })
        const res = await fetch(src, { signal: ac.signal, mode: 'cors' })
        return res.blob()
      })()
      const bmp = await createImageBitmap(blob)
      setupLayer(bmp)
      imageHook.trigger({
        bmp,
        blob,
        isRaw,
        variant: toValue(variant),
      })
      return bmp
    } catch (err) {
      catchError(err)
    } finally {
      loadController.value = null
    }
  }

  watch(
    containerRef,
    container => {
      destory()
      container && setup(container)
    },
    { immediate: true },
  )

  // 滚轮缩放图片
  useEventListener(
    containerRef,
    'wheel',
    (ev: WheelEvent) => {
      const image = context.image.value
      if (!image) return

      // 1. 获取容器的中心点（相对于容器左上角的像素坐标）
      // 如果 containerRef 可以拿到 DOM，建议动态获取 clientWidth/Height
      const container = containerRef.value
      if (!container) return

      const pointer = {
        x: container.clientWidth / 2,
        y: container.clientHeight / 2,
      }

      // 2. 记住缩放前的 旧缩放比例
      const oldScaleX = image.scaleX()
      const oldScaleY = image.scaleY()

      // 3. 计算 缩放前 中心点在图层内部的世界坐标
      const mousePointTo = {
        x: (pointer.x - image.x()) / oldScaleX,
        y: (pointer.y - image.y()) / oldScaleY,
      }

      // 4. 计算 新的缩放比例
      const factor = 1 - ev.deltaY / 1000
      const newScaleX = oldScaleX * factor
      const newScaleY = oldScaleY * factor

      // 5. 应用新缩放
      image.scale({ x: newScaleX, y: newScaleY })

      // 6. 根据“世界坐标在缩放后应对齐同一屏幕位置”的反向公式，计算出图层新的【绝对坐标】
      const newPos = {
        x: pointer.x - mousePointTo.x * newScaleX,
        y: pointer.y - mousePointTo.y * newScaleY,
      }

      image.position(newPos)
    },
    { passive: true },
  )

  return {
    ready,
    destory,
    loadFromFile,
    loadFromSrc,
    onImageLoad: imageHook.on,
    onError: errorHook.on,
    onFrame: frameHook.on,
  }
}

interface ImageCropperOptions {
  /** 是否禁用裁切器 */
  disabled?: MaybeRef<boolean>
  /** 图标变体类型 */
  variant?: MaybeRef<IconVariant>
  /** 是否保持 1:1 正方形比例 */
  keepRatio?: MaybeRef<boolean>
}
