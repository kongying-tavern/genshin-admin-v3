export declare namespace MapWindow {
  interface Coordinate {
    x: number
    y: number
  }

  interface Size {
    width: number
    height: number
  }

  type SizeState = 'default' | 'maximize' | 'minimize'

  type InteractionState = 'default' | 'manual'

  type ResizeProps = Partial<Coordinate & Size>

  interface WindowOpenParams {
    id: string
    name: string
    /** @default 300 */
    minWidth?: number
    /** @default 300 */
    minHeight?: number
    /** 窗口打开时的位置 @default 0 */
    x?: number
    /** 窗口打开时的位置 @default 0 */
    y?: number
    /** 窗口打开时处于屏幕中间, 会覆盖 x 和 y 指定的位置 */
    center?: boolean
    /** 窗口打开时的尺寸状态 */
    sizeState?: SizeState
    /** 指定窗口容器 @default document.body */
    container?: HTMLElement
    /**
     * 打开前的回调，返回非 true 值会阻止打开
     */
    beforeOpen?: () => boolean
    /**
     * 关闭前的回调，返回非 true 值会阻止关闭
     */
    beforeClose?: () => boolean
  }

  interface Info extends WindowOpenParams {
    translate: Coordinate
    size: Size
    interactionState?: InteractionState
    order: number
    ref: HTMLElement | null
  }

  interface Context {
    /** 拖动识别 id，固定值 */
    dragHookId: string

    /** 当前正处于过度状态的窗口 id */
    transitionId: string

    /** 窗口是否已置顶 */
    isTop: (id: string) => boolean

    /** 通过 id 获取窗口信息 */
    getWindow: (id: string) => Info | undefined

    /** 获取所有窗口信息 */
    getWindows: () => Map<string, Info>

    /** 清除所有窗口 */
    clearWindow: () => void

    /** 置顶指定 id 的面板 */
    topping: (id: string) => void

    /** 移动指定的面板 */
    move: (id: string, pos: Coordinate) => void

    /** 打开窗口，如果已存在对应 id 的面板则跳过操作 */
    openWindow: (params: WindowOpenParams) => void

    /** 更新窗口信息，除了 id */
    updateWindow: (id: string, params: Partial<Omit<WindowOpenParams, 'id'>>) => void

    /** 关闭窗口 */
    closeWindow: (id: string) => void

    /**
     * 设置窗口尺寸状态
     * - `default` 默认
     * - `maximize` 最大化
     * - `minimize` 最小化
     */
    setSizeState: (id: string, state?: SizeState) => void

    /**
     * 设置窗口交互状态
     * - `default` 默认
     * - `manual` 正在由用户直接控制（也包括自动测试工具）
     */
    setInteractionState: (id: string, state?: InteractionState) => void

    /** 移动窗口 */
    move: (id: string, pos: { x: number; y: number }) => void

    /** 调整窗口尺寸 */
    resize: (id: string, rect: ResizeProps) => void

    /** 优化窗口位置，使其返回可见区域 */
    optimizeWindowPosition: (box?: ResizeObserverSize) => void
  }

  interface WindowDragHookOptions {
    context: Context
  }
}
