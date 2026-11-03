interface Set<T> {
  /** 该方法采用一个集合并返回一个包含该集合和给定集合中元素的新集合。 */
  intersection: (other: Set<T>) => Set<T>

  /** 该方法采用一个集合并返回一个布尔值，指示该集合是否与给定集合没有共同的元素。 */
  isDisjointFrom: (other: Set<T>) => boolean

  /** 该方法采用一个集合并返回一个新集合，其中包含此集合或给定集合中的元素，但不在两者中。 */
  symmetricDifference: (other: Set<T>) => Set<T>

  /** 该方法采用一个集合并返回一个新集合，其中包含此集合中的元素，但不包含给定集合中的元素。 */
  difference: (other: Set<T>) => Set<T>

  /** 方法采取一个集合并返回一个新的集合，该集合包含该集合和给定集合中的一个或两个元素。 */
  union: (other: Set<T>) => Set<T>
}

interface ViewTransition {
  finished: Promise<void>
  ready: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}

interface Document {
  startViewTransition: (callback: () => void) => ViewTransition
}

interface Window {
  /** @实验性的 显示一个文件选择器，以允许用户选择一个或多个文件并返回这些文件的句柄 */
  showOpenFilePicker: (options?: {
    /** 应用文件类型过滤器. */
    excludeAcceptAllOption?: boolean
    /** 通过指定 ID，浏览器可以为不同的 ID 记住不同的目录。 */
    id?: string
    /** 布尔值，默认为 `false`。当设置为 `true` 时，可以选择多个文件。 */
    multiple?: boolean
    /** 一个 `FileSystemHandle` 对象或一个众所周知的目录 */
    startIn?: FileSystemHandle | string
    /** 允许选择的文件类型的数组。每个项目都是一个具有以下选项的对象： */
    types?: {
      /** 允许的文件类型类别的可选描述。默认为空字符串。 */
      description?: string
      /** 一个 Object，其键设置为 MIME 类型，值设置为文件扩展名的数组（参见下面的示例）。 */
      accept: Record<string, string[]>
    }[]
  }) => Promise<FileSystemFileHandle[]>
}

interface FontFaceSet {
  add: (font: FontFace) => void
}

/**
 * 优先任务调度 API 的调度程序界面提供了用于调度优先任务的方法。
 *
 * 可以使用 worker 中的 `Window.Scheduler` 或 `WorkerGlobalScope.Scheduler` 从全局对象访问调度器。
 *
 * @note 仅 Chrome 系可用 (2024-10-30)
 */
declare const scheduler: {
  /**
   * `Scheduler` 接口的 `postTask()` 方法用于根据优先级添加要调度的任务。
   *
   * 该方法允许用户可选地指定任务运行前的最小延迟、任务的优先级以及可用于修改任务优先级和/或中止任务的信号。
   *
   * 它返回一个 `promise`，该 `promise` 使用任务回调函数的结果进行解析，或者使用中止原因或任务中抛出的错误进行拒绝。
   *
   * 任务优先级可以是可变的或不可变的。如果任务优先级永远不需要更改，则应使用 `options.priority` 参数进行设置（通过信号设置的任何优先级都将被忽略）。
   *
   * 您仍然可以将 `AbortSignal`（没有优先级）或 `TaskSignal` 传递给 `options.signal` 参数以中止任务。
   *
   * 如果可能需要更改任务优先级，则不得设置 `options.priority` 参数。相反，应该创建一个 `TaskController`，
   * 并将其 `TaskSignal` 传递给 `options.signal`。
   *
   * 任务优先级将从信号优先级初始化，稍后可以使用信号的相关 `TaskController` 进行修改。
   *
   * 如果没有设置优先级，则任务优先级默认为“用户可见”。
   *
   * 如果指定了延迟并且大于 0，则任务的执行将延迟至少那么多毫秒。否则，任务将立即安排优先级。
   */
  postTask: (
    callback: () => void,
    options?: {
      /**
       * 任务的不可变优先级。以下其中之一:
       * ```
       * 'user-blocking' // 用户屏蔽
       * 'user-visible' // 用户可见
       * 'background' // 背景
       * ```
       * 如果已设置，则此优先级将在任务的生命周期内使用，并且忽略在信号上设置的优先级。
       */
      priority?: 'user-blocking' | 'user-visible' | 'background'
      /**
       * 如果设置了 `options.priority` 参数，则无法更改任务优先级，
       * 并且忽略信号上的任何优先级。
       *
       * 否则，如果信号是 `TaskSignal`，则其优先级用于设置初始任务优先级，
       * 信号的控制器稍后可能会使用它来更改任务优先级。
       */
      signal?: AbortSignal
      /**
       * 将任务添加到调度程序队列后的最短时间，以毫秒为单位。实际延迟可能高于指定值，但不会低于指定值。默认延迟为 0。
       */
      delay?: number
    },
  ) => void

  /**
   * 调度器接口的 `yield()` 方法用于在任务期间向主线程让步，并在以后继续执行，
   * 将继续作为优先任务进行调度（有关更多信息，请参阅优先任务调度API）。
   *
   * 这允许分解长时间运行的工作，以便浏览器保持响应。
   *
   *
   * 当方法返回的 `promise` 被解析时，任务可以继续。
   *
   * 当 `promise` 被解析时的优先级默认为“用户可见”，但如果 `yield()` 调用发生在 `Scheduler.postTask()` 回调中，
   * 则可以继承不同的优先级。
   *
   * 此外，如果 `yield()` 调用后的工作继续发生在 `postTask()` 回调中，并且任务被中止，则可以取消。
   */
  yield: () => Promise<void>
}

interface PaintRenderingContext2D
  extends
    CanvasCompositing,
    CanvasDrawImage,
    CanvasDrawPath,
    CanvasFillStrokeStyles,
    CanvasFilters,
    CanvasImageSmoothing,
    CanvasPath,
    CanvasPathDrawingStyles,
    CanvasRect,
    CanvasSettings,
    CanvasShadowStyles,
    CanvasState,
    CanvasTransform {}

/**
 * 表示绘制输出位图的尺寸。
 *
 * @see https://drafts.css-houdini.org/css-paint-api-1/#paintsize
 */
interface PaintSize {
  /** 输出位图的宽度（以 CSS 像素为单位） */
  readonly width: number
  /** 输出位图的高度（以 CSS 像素为单位） */
  readonly height: number
}

/**
 * 绘制画布所关联的渲染上下文设置。
 *
 * @see https://drafts.css-houdini.org/css-paint-api-1/#dictdef-paintrenderingcontext2dsettings
 */
interface PaintRenderingContext2DSettings {
  /** 是否允许 alpha 透明度。默认为 `true`。设置为 `false` 时，所有颜色都将完全不透明 */
  alpha: boolean
}

/**
 * 自定义绘制类实例需要实现的接口。
 *
 * @see https://drafts.css-houdini.org/css-paint-api-1/#registering-custom-paint
 */
interface IPaintClass {
  /**
   * 渲染引擎在绘制阶段调用的回调方法，用于在位图上执行自定义绘制。
   *
   * @param ctx - 2D 渲染上下文，是 HTML Canvas API 的子集（不包含 CanvasImageData、CanvasUserInterface、CanvasText、CanvasTextDrawingStyles）
   * @param size - 输出位图的尺寸
   * @param properties - 包含 `inputProperties` 中声明的 CSS 属性（含自定义属性）的只读属性映射
   * @param args - 从 CSS `paint()` 函数传递的输入参数，对应 `inputArguments` 中声明的语法
   */
  paint(
    ctx: PaintRenderingContext2D,
    size: PaintSize,
    properties: StylePropertyMapReadOnly,
    args: CSSStyleValue[],
  ): void
}

/**
 * 自定义绘制类构造器接口。
 *
 * 静态 getter `inputProperties`、`inputArguments`、`contextOptions` 为可选的类级配置，
 * 由渲染引擎在注册时读取。
 *
 * @see https://drafts.css-houdini.org/css-paint-api-1/#registering-custom-paint
 */
interface PaintClass {
  new (): IPaintClass
  /** 声明需要监听的 CSS 属性列表（包括自定义属性），其值变化会触发重绘 */
  readonly inputProperties?: string[]
  /** 声明可从 CSS `paint()` 函数传递的参数的 CSS 语法字符串列表 */
  readonly inputArguments?: string[]
  /** 渲染上下文的设置，控制是否允许 alpha 透明度 */
  readonly contextOptions?: PaintRenderingContext2DSettings
}

declare const registerPaint:
  | {
      (name: string, classRef: PaintClass): void
    }
  | undefined
