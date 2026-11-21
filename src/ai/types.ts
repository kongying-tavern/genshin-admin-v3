/**
 * AI 页面句柄与信息反射层：公共类型定义。
 *
 * 该文件是叶子模块，不允许引入 stores / components / 运行时副作用。
 */

/** 桥接模式，off 表示不安装 */
export type BridgeMode = 'off' | 'read' | 'write'

/** 访问级别 */
export type BridgeAccess = 'read' | 'write'

/** 模式来源，用于排障 */
export type ModeSource = 'query' | 'storage' | 'env' | 'dev' | 'default'

/** 统一错误码 */
export type ErrorCode =
  | 'E_UNKNOWN_COMMAND'
  | 'E_INVALID_PARAMS'
  | 'E_FORBIDDEN'
  | 'E_UNKNOWN_SURFACE'
  | 'E_UNSUPPORTED'
  | 'E_UNAVAILABLE'
  | 'E_NOT_FOUND'
  | 'E_BUSY'
  | 'E_TIMEOUT'
  | 'E_DOMAIN'
  | 'E_INTERNAL'

/** 错误描述 */
export interface BridgeErrorInfo {
  code: ErrorCode
  message: string
  details?: unknown
  hint?: string
}

/** 参数类型 */
export type ParamType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'

/** 轻量参数 schema，可由 toJsonSchema 转成 JSON Schema */
export interface FieldSchema {
  type?: ParamType | ParamType[]
  description?: string
  enum?: readonly (string | number)[]
  default?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  items?: FieldSchema
  properties?: Record<string, FieldSchema>
  required?: readonly string[]
  additionalProperties?: boolean
}

/** 对象参数 schema */
export interface ObjectSchema extends FieldSchema {
  type: 'object'
  properties: Record<string, FieldSchema>
}

/** 序列化选项 */
export interface SanitizeOptions {
  /** 最大递归深度 @default 6 */
  maxDepth?: number
  /** 数组最大长度 @default 200 */
  maxArrayLength?: number
  /** 对象最大字段数 @default 100 */
  maxObjectKeys?: number
  /** 字符串最大长度 @default 20000 */
  maxStringLength?: number
  /** 需要脱敏的键名（大小写不敏感，额外叠加内置敏感键） */
  redactKeys?: readonly string[]
}

/** 事件记录 */
export interface EventRecord {
  seq: number
  ts: number
  type: string
  payload: unknown
}

/** 事件查询参数 */
export interface EventListOptions {
  afterSeq?: number
  limit?: number
  type?: string
}

/** 等待事件参数 */
export interface WaitForOptions {
  type: string
  /** payload 的子集匹配 */
  match?: unknown
  /** 只查该序号之后的事件；缺省只等未来事件 */
  sinceSeq?: number
  timeoutMs?: number
}

/** 命令执行上下文 */
export interface CommandContext {
  readonly mode: BridgeAccess
  readonly emit: (type: string, payload?: unknown) => EventRecord
  readonly currentSeq: () => number
  readonly now: () => number
}

/** 命令处理器 */
export type CommandHandler = (
  params: Record<string, unknown>,
  context: CommandContext,
) => unknown | Promise<unknown>

/** 命令示例 */
export interface BridgeExample {
  title: string
  params?: unknown
}

/** 命令定义 */
export interface BridgeCommand {
  /** 形如 `datasets.list` */
  id: string
  title: string
  description: string
  /** @default read */
  access?: BridgeAccess
  tags?: string[]
  params?: ObjectSchema
  returns?: string
  examples?: BridgeExample[]
  /** 该命令结果的自定义序列化选项 */
  sanitize?: SanitizeOptions
  handler: CommandHandler
}

/** 页面句柄类型 */
export type SurfaceKind = 'dialog' | 'window' | 'popover' | 'panel' | 'form'

/** 页面句柄定义 */
export interface SurfaceDefinition<P = unknown> {
  id: string
  kind: SurfaceKind
  title: string
  description?: string
  /** 权限/挂载条件，实时求值 */
  enabled?: () => boolean
  open?: (params?: P) => unknown | Promise<unknown>
  close?: () => unknown | Promise<unknown>
  getState?: () => unknown
}

/** 表单字段元信息 */
export interface FormFieldMeta {
  key: string
  label?: string
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
  secret?: boolean
  readonly?: boolean
  description?: string
}

/** 表单成功/失败钩子注册函数 */
export type FormSuccessHook = (callback: () => void) => { off?: () => void } | void
export type FormErrorHook = (callback: (error: Error) => void) => { off?: () => void } | void

/** 表单定义 */
export interface FormDefinition {
  id: string
  title: string
  description?: string
  fields?: FormFieldMeta[]
  readonlyFields?: readonly string[]
  sensitiveFields?: readonly string[]
  getValues: () => Record<string, unknown>
  setValues?: (patch: Record<string, unknown>) => void | Promise<void>
  validate?: () => void | Promise<void>
  submit?: () => unknown | Promise<unknown>
  close?: () => void
  isBusy?: () => boolean
  isDirty?: () => boolean
  events?: {
    onSuccess?: FormSuccessHook
    onError?: FormErrorHook
  }
}

/** 表单提交结果 */
export interface FormOutcome {
  success: boolean | null
  error?: string
  timedOut?: boolean
  validationError?: boolean
}

/** 页面句柄信息 */
export interface SurfaceInfo {
  id: string
  kind: SurfaceKind
  title: string
  description?: string
  available: boolean
  open?: boolean
  state?: unknown
  stateError?: string
  form?: {
    busy?: boolean
    dirty?: boolean
  }
}

/** 地图上下文绑定 */
export interface MapContextBinding {
  getViewState?: () => unknown
  getContainerSize?: () => { width: number; height: number }
}

/** 调用元信息 */
export interface CallMeta {
  durationMs: number
  startedAt: number
  /** command:end 事件序号 */
  seq: number
  /** 命令执行前的事件序号 */
  sinceSeq: number
}

/** call 返回包裹 */
export type CallEnvelope<T> =
  | {
      ok: true
      command: string
      data: T
      meta: CallMeta
    }
  | {
      ok: false
      command: string
      error: BridgeErrorInfo
      meta: CallMeta
    }

/** 快照 section key */
export type SnapshotSectionKey =
  | 'app'
  | 'auth'
  | 'ui'
  | 'map'
  | 'resources'
  | 'datasets'
  | 'archive'
  | 'socket'
  | 'forms'

/** 快照参数 */
export interface SnapshotOptions {
  /** 默认全部 section */
  sections?: readonly SnapshotSectionKey[]
  /** 是否包含句柄状态 @default true */
  includeSurfaceStates?: boolean
  /** 是否包含窗口状态 @default true */
  includeWindowStates?: boolean
  /** 字符串最大长度 @default 20000 */
  maxStringLength?: number
}

/** 快照构建上下文 */
export interface SnapshotContext {
  includeSurfaceStates: boolean
  includeWindowStates: boolean
  maxStringLength: number
  now: () => number
}

/** 快照 section */
export interface SnapshotSection {
  key: SnapshotSectionKey
  title: string
  build: (context: SnapshotContext) => unknown | Promise<unknown>
}

/** 快照结果 */
export interface SnapshotResult {
  meta: {
    schemaVersion: number
    capturedAt: number
    durationMs: number
    requestedSections: string[]
    failedSections: { section: string; error: string }[]
  }
  [key: string]: unknown
}

/** manifest 中的命令 */
export interface ManifestCommand {
  id: string
  title: string
  description: string
  access: BridgeAccess
  tags?: string[]
  params?: unknown
  returns?: string
  examples?: BridgeExample[]
  /** 当前模式下是否允许调用 */
  allowed: boolean
}

/** manifest 中的句柄 */
export interface ManifestSurface {
  id: string
  kind: SurfaceKind
  title: string
  description?: string
  available: boolean
}

/** 完整契约 */
export interface BridgeManifest {
  protocol: 'map-ai-bridge'
  protocolVersion: string
  schemaVersion: number
  mode: BridgeAccess
  modeSource: ModeSource
  commands: ManifestCommand[]
  surfaces: ManifestSurface[]
  events: string[]
  errorCodes: { code: ErrorCode; description: string }[]
  snapshotSections: SnapshotSectionKey[]
  enablement: {
    query: string
    storage: string
    env: string
    devDefault: BridgeMode
    prodDefault: BridgeMode
  }
}

/** 命名空间方法集合 */
export type BridgeNamespace = Record<string, (params?: unknown) => Promise<unknown>>

/** events 命名空间（保留精确类型） */
export interface EventNamespace {
  list: (options?: EventListOptions) => Promise<EventRecord[]>
  waitFor: (options: WaitForOptions) => Promise<EventRecord>
  [name: string]: unknown
}

/** 全局桥接对象 */
export interface MapAiBridge {
  readonly protocolVersion: string
  readonly schemaVersion: number
  readonly mode: BridgeAccess
  readonly modeSource: ModeSource
  readonly installedAt: number

  help: (options?: { group?: string }) => string
  manifest: () => BridgeManifest
  snapshot: (options?: SnapshotOptions) => Promise<SnapshotResult>
  call: <T = unknown>(command: string, params?: unknown) => Promise<CallEnvelope<T>>
  dispose: () => void

  readonly events: EventNamespace
  readonly app: BridgeNamespace
  readonly ui: BridgeNamespace
  readonly auth: BridgeNamespace
  readonly datasets: BridgeNamespace
  readonly markers: BridgeNamespace
  readonly resources: BridgeNamespace
  readonly map: BridgeNamespace
  readonly archive: BridgeNamespace
  readonly forms: BridgeNamespace
  readonly dev: BridgeNamespace
}
