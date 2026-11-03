import type { MapWindow } from '../types'
import { clamp } from 'lodash'

export class WindowContext implements MapWindow.Context {
  readonly HEADER_HEIGHT = 30
  readonly MIN_WIDTH = 300
  readonly MIN_HEIGHT = 300

  readonly dragHookId = [...crypto.getRandomValues(new Uint8Array(4))]
    .map(num => num.toString(16).padStart(2, '0'))
    .join('')

  #transitionId = ref('')
  get transitionId() {
    return this.#transitionId.value
  }

  protected panels: Ref<Map<string, MapWindow.Info>> = ref(new Map())

  protected cachedInfos: Map<string, MapWindow.Info> = new Map()

  closeHook = createEventHook<string>()

  protected topOrder = computed(() => {
    let order = 0
    this.panels.value.forEach(panel => {
      order = Math.max(order, panel.order)
    })
    return order
  })

  isTop = (id: string) => {
    const panel = this.panels.value.get(id)
    if (!panel) return false
    return panel.order === this.topOrder.value
  }

  getWindow = (id: string) => {
    return this.panels.value.get(id)
  }

  getWindows = () => {
    return this.panels.value
  }

  openWindow = async (params: MapWindow.WindowOpenParams) => {
    if (this.panels.value.has(params.id)) return

    const openable = params.beforeOpen ? params.beforeOpen() : true
    if (!openable) return

    const { center = false, container = document.body } = params

    let {
      x: initX = 0,
      y: initY = 0,
      minWidth = this.MIN_WIDTH,
      minHeight = this.MIN_HEIGHT,
    } = params

    minWidth = Math.min(minWidth, container.clientWidth)
    minHeight = Math.min(minHeight, container.clientHeight)

    // 如果指定了 center，则在首次打开窗口时将 xy 修改为对应的值使得窗口居中
    if (center) {
      // 获取容器中心点
      const centerX = container.clientWidth / 2
      const centerY = container.clientHeight / 2
      // 计算窗口左上角坐标
      initX = centerX - minWidth / 2
      initY = centerY - minHeight / 2
    }

    const {
      translate: { x = initX, y = initY } = {},
      sizeState = params.sizeState,
      size,
    } = this.cachedInfos.get(params.id) ?? {}

    const info = {
      ...params,
      translate: { x, y },
      size: size ?? { width: minWidth, height: minHeight },
      order: this.topOrder.value + 1,
      ref: null,
      sizeState,
    }

    this.#transitionId.value = params.id
    ;(await document.startViewTransition?.(() => {
      this.panels.value.set(params.id, info)
    })?.ready) ?? this.panels.value.set(params.id, info)
    this.#transitionId.value = ''

    this.cachedInfos.set(params.id, info)
    this.optimizeWindowPosition()
  }

  updateWindow = (id: string, params: Partial<Omit<MapWindow.WindowOpenParams, 'id'>>) => {
    if (!this.panels.value.has(id)) return

    const currentInfo = this.panels.value.get(id)!

    const {
      minHeight: height = currentInfo.size.width,
      minWidth: width = currentInfo.size.height,
      beforeClose = currentInfo.beforeClose,
      name = currentInfo.name,
      x = currentInfo.translate.x,
      y = currentInfo.translate.y,
    } = params

    currentInfo.beforeClose = beforeClose
    currentInfo.size = { width, height }
    currentInfo.translate = { x, y }
    currentInfo.name = name

    this.cachedInfos.set(id, currentInfo)
    this.optimizeWindowPosition()
  }

  setSizeState = (id: string, state: MapWindow.SizeState = 'default') => {
    const panel = this.panels.value.get(id)
    if (!panel) return
    panel.sizeState = state === panel.sizeState ? 'default' : state
    this.optimizeWindowPosition()
  }

  setInteractionState = (id: string, state: MapWindow.InteractionState = 'default') => {
    const panel = this.panels.value.get(id)
    if (!panel) return
    panel.interactionState = state
    this.optimizeWindowPosition()
  }

  closeWindow = async (id: string) => {
    const panel = this.panels.value.get(id)
    if (!panel) return

    const closable = panel.beforeClose ? panel.beforeClose() : true
    if (!closable) return

    const { order } = panel
    this.panels.value.forEach(iPanel => {
      if (iPanel.order <= order) return
      iPanel.order -= 1
    })

    this.panels.value.delete(id)
    this.closeHook.trigger(id)
  }

  clearWindow = () => {
    this.panels.value.forEach(panel => this.closeWindow(panel.id))
  }

  topping = (id: string) => {
    const target = this.panels.value.get(id)
    if (!target || target.order === this.topOrder.value) return

    let moveOrder = 0
    this.panels.value.forEach(panel => {
      if (panel.order <= target.order) return
      panel.order -= 1
      moveOrder += 1
    })

    target.order += moveOrder
  }

  move = (id: string, pos: { x: number; y: number }) => {
    const target = this.panels.value.get(id)
    if (!target) return

    target.translate = pos
    const cache = this.cachedInfos.get(id)
    if (!cache) return
    cache.translate = pos
  }

  resize = (id: string, rect: MapWindow.ResizeProps) => {
    const cache = this.cachedInfos.get(id)
    if (!cache) return

    const target = this.panels.value.get(id)
    if (!target) return

    const { clientWidth, clientHeight } = document.body

    const { translate, size, minWidth = this.MIN_WIDTH, minHeight = this.MIN_HEIGHT } = target

    const { x = translate.x, y = translate.y, width = size.width, height = size.height } = rect

    const resizeWidth = Math.min(Math.max(width, minWidth), clientWidth)
    const resizeheight = Math.min(Math.max(height, minHeight), clientHeight)

    target.translate = {
      x: resizeWidth === size.width ? translate.x : x,
      y: resizeheight === size.height ? translate.y : y,
    }

    target.size = {
      width: resizeWidth,
      height: resizeheight,
    }

    cache.translate = target.translate
    cache.size = target.size
  }

  optimizeWindowPosition = (box?: ResizeObserverSize) => {
    const { clientWidth, clientHeight } = document.body

    const { inlineSize = clientWidth, blockSize = clientHeight } = box ?? {}
    this.panels.value.forEach(info => {
      const { width, height } = info.size
      const { x, y } = info.translate
      info.translate =
        info.sizeState === 'minimize'
          ? {
              x: clamp(x, 0, Math.max(0, inlineSize - this.MIN_WIDTH)),
              y: clamp(y, 0, Math.max(0, blockSize - this.HEADER_HEIGHT)),
            }
          : {
              x: clamp(x, 0, Math.max(0, inlineSize - width)),
              y: clamp(y, 0, Math.max(0, blockSize - height)),
            }
      info.size = {
        width: Math.min(clientWidth, info.size.width),
        height: Math.min(clientHeight, info.size.height),
      }
    })
  }
}
