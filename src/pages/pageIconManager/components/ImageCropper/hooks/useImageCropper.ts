import type { Unsubscribable } from 'rxjs'
import type { ShallowRef } from 'vue'
import type { IconVariant } from '@/pages/pageIconManager/types'
import { clamp } from '@vueuse/core'
import Konva from 'konva'

const config = {
  anchorFill: '#FFF',
  anchorStroke: '#00CCFF',
}

/** 选区最小边长（px） */
const MIN_RECT_SIZE = 32
/** 自适应后图标最长边的尺寸（px） */
const AUTO_FIT_SIZE = 64
/** 滚轮缩放时底图最长边的最小显示尺寸（px） */
const MIN_IMAGE_EDGE = 8

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
    // 底图适配画布且不做放大，避免小图被拉伸铺满后选框失去可移动空间
    const ratio = Math.min(1, cw / bmp.width, ch / bmp.height)
    const dw = bmp.width * ratio
    const dh = bmp.height * ratio
    const dx = (cw - dw) / 2
    const dy = (ch - dh) / 2
    // 创建图层
    const layer = new Konva.Layer()
    // 创建图片层
    const image: Konva.Image = new Konva.Image({
      image: bmp,
      x: dx,
      y: dy,
      width: dw,
      height: dh,
      draggable: true,
      dragBoundFunc({ x, y }) {
        // 限制在画布可视范围内，避免底图被拖出画布后无法找回
        const { width: cw, height: ch } = stage.getSize()
        const w = image.width() * image.scaleX()
        const h = image.height() * image.scaleY()
        return {
          x: Math.round(clamp(x, Math.min(0, cw - w), Math.max(0, cw - w))),
          y: Math.round(clamp(y, Math.min(0, ch - h), Math.max(0, ch - h))),
        }
      },
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
        // 限制在画布可视范围内，避免选框被拖出画布后无法找回
        const { width: w, height: h } = this.getClientRect()
        const { width: cw, height: ch } = stage.getSize()
        return {
          x: Math.round(clamp(x, Math.min(0, cw - w), Math.max(0, cw - w))),
          y: Math.round(clamp(y, Math.min(0, ch - h), Math.max(0, ch - h))),
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
      boundBoxFunc: (_, { x, y, width, height }) => {
        const { width: cw, height: ch } = stage.getSize()
        const keep = toValue(keepRatio)
        const minSide = Math.min(MIN_RECT_SIZE, rectSize, cw, ch)
        let w = clamp(width, minSide, cw)
        let h = clamp(height, minSide, ch)
        if (keep) {
          const side = Math.min(w, h)
          w = side
          h = side
        }
        // 使用调整后的尺寸计算边界，避免选框位置跳动
        return {
          x: Math.round(clamp(x, 0, cw - w)),
          y: Math.round(clamp(y, 0, ch - h)),
          width: Math.round(w),
          height: Math.round(h),
          rotation: 0,
        }
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
    // 将变换产生的缩放折叠回宽高，保证后续尺寸换算一致
    rect.on('transformend', () => {
      const { x: rx, y: ry, width: rw, height: rh } = rect.getClientRect({ skipStroke: true })
      rect.setAttrs({
        x: Math.round(rx),
        y: Math.round(ry),
        width: Math.round(rw),
        height: Math.round(rh),
        scaleX: 1,
        scaleY: 1,
      })
      tr.forceUpdate()
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
      const stage = context.stage.value
      const transformer = context.transformer.value
      const rect = context.rect.value
      const image = context.image.value
      if (!stage || !transformer || !rect || !image) return
      transformer.keepRatio(v)
      if (v) {
        // 开启时将选区收敛为正方形，保持 1:1 语义
        const { width: cw, height: ch } = stage.getSize()
        const { x: rx, y: ry, width: rw, height: rh } = rect.getClientRect({ skipStroke: true })
        const size = Math.min(rw, rh, cw, ch)
        const nx = clamp(rx, 0, cw - size)
        const ny = clamp(ry, 0, ch - size)
        rect.setAttrs({
          x: Math.round(nx),
          y: Math.round(ny),
          width: Math.round(size),
          height: Math.round(size),
          scaleX: 1,
          scaleY: 1,
        })
        transformer.forceUpdate()
      }
    })
  }

  /**
   * 自适应
   * - 底图以 contain 方式缩放到最长边 `AUTO_FIT_SIZE` 并水平垂直居中
   * - 选区收敛为居中的 `AUTO_FIT_SIZE` 正方形
   */
  const autoFit = () => {
    const stage = context.stage.value
    const image = context.image.value
    const rect = context.rect.value
    const transformer = context.transformer.value
    if (!stage || !image || !rect || !transformer)
      return

    const { width: cw, height: ch } = stage.getSize()
    const baseW = image.width()
    const baseH = image.height()
    if (!baseW || !baseH)
      return

    // 底图最长边缩放为 64px 并居中
    const scale = AUTO_FIT_SIZE / Math.max(baseW, baseH)
    const w = baseW * scale
    const h = baseH * scale
    image.position({
      x: (cw - w) / 2,
      y: (ch - h) / 2,
    })
    image.scale({ x: scale, y: scale })

    // 选区固定为 64x64 并居中
    const side = Math.min(AUTO_FIT_SIZE, cw, ch)
    rect.setAttrs({
      x: Math.round((cw - side) / 2),
      y: Math.round((ch - side) / 2),
      width: side,
      height: side,
      scaleX: 1,
      scaleY: 1,
    })
    transformer.forceUpdate()
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
      const baseEdge = Math.max(image.width(), image.height()) || 1
      const minScale = MIN_IMAGE_EDGE / baseEdge
      const newScaleX = Math.max(minScale, oldScaleX * factor)
      const newScaleY = Math.max(minScale, oldScaleY * factor)

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
    autoFit,
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
