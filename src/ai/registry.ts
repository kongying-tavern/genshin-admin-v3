import type {
  BridgeAccess,
  BridgeCommand,
  BridgeManifest,
  BridgeNamespace,
  CallEnvelope,
  CallMeta,
  MapAiBridge,
  ModeSource,
  SnapshotOptions,
  SnapshotResult,
} from './types'
import type { EventLog } from './events'
import { MapAiError, toErrorInfo } from './errors'
import { sanitize } from './sanitize'
import { validateParams } from './validate'

export interface CreateBridgeOptions {
  mode: BridgeAccess
  modeSource: ModeSource
  installedAt?: number
  commands: BridgeCommand[]
  eventLog: EventLog
  snapshot: (options?: SnapshotOptions) => Promise<SnapshotResult>
  manifest: () => BridgeManifest
  help: (options?: { group?: string }) => string
  onDispose?: () => void
  now?: () => number
  protocolVersion?: string
  schemaVersion?: number
}

export interface BridgeInstance {
  bridge: MapAiBridge
  dispose: () => void
}

const COMMAND_ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/

const makeError = (info: ReturnType<typeof toErrorInfo>) =>
  new MapAiError(info.code, info.message, {
    ...(info.details === undefined ? {} : { details: info.details }),
    ...(info.hint === undefined ? {} : { hint: info.hint }),
  })

const suggestCommands = (input: string, commands: BridgeCommand[]): string[] => {
  const prefix = input.split('.')[0]
  return commands
    .map(command => command.id)
    .filter(id => id !== input && (id.startsWith(prefix) || id.includes(input)))
    .slice(0, 3)
}

const buildNamespace = (
  commands: BridgeCommand[],
  run: (command: BridgeCommand, params?: unknown) => Promise<unknown>,
): Record<string, unknown> => {
  const root: Record<string, unknown> = {}
  const leaves = new Set<string>()

  for (const command of commands) {
    const parts = command.id.split('.')
    if (leaves.has(command.id)) throw new Error(`重复的命令 id：${command.id}`)
    leaves.add(command.id)

    let cursor = root
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index]
      const next = cursor[part]
      if (next === undefined) {
        const namespace: Record<string, unknown> = {}
        cursor[part] = namespace
        cursor = namespace
      } else if (typeof next === 'object' && next !== null) {
        cursor = next as Record<string, unknown>
      } else {
        throw new Error(`命令 id 冲突：${command.id}`)
      }
    }

    const leaf = parts[parts.length - 1]
    if (leaf in cursor) throw new Error(`命令 id 冲突：${command.id}`)
    cursor[leaf] = (params?: unknown) => run(command, params)
  }

  for (const command of commands) {
    const parts = command.id.split('.')
    for (let index = 1; index < parts.length; index += 1) {
      const prefix = parts.slice(0, index).join('.')
      if (leaves.has(prefix)) throw new Error(`命令 id 不能同时是命名空间：${prefix}`)
    }
  }

  return root
}

const freezeNamespace = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null) return value
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) freezeNamespace(record[key])
  return Object.freeze(value)
}

/** 创建桥接运行时（不负责挂载到 window） */
export const createBridge = (options: CreateBridgeOptions): BridgeInstance => {
  const now = options.now ?? Date.now
  const installedAt = options.installedAt ?? now()
  const protocolVersion = options.protocolVersion ?? '1.0.0'
  const schemaVersion = options.schemaVersion ?? 1
  const commandMap = new Map<string, BridgeCommand>()

  for (const command of options.commands) {
    if (!COMMAND_ID_PATTERN.test(command.id)) {
      throw new Error(`非法命令 id：${command.id}`)
    }
    if (commandMap.has(command.id)) throw new Error(`重复的命令 id：${command.id}`)
    if (!command.title || !command.description) {
      throw new Error(`命令 ${command.id} 缺少 title/description`)
    }
    commandMap.set(command.id, command)
  }

  const buildMeta = (startedAt: number, sinceSeq: number, seq: number): CallMeta => ({
    startedAt,
    sinceSeq,
    seq,
    durationMs: Math.max(0, now() - startedAt),
  })

  const invoke = async (commandId: string, params: unknown): Promise<CallEnvelope<unknown>> => {
    const startedAt = now()
    const sinceSeq = options.eventLog.currentSeq()
    const command = commandMap.get(commandId)
    let seq = sinceSeq

    const finish = (envelope: CallEnvelope<unknown>) => {
      seq = options.eventLog.emit('command:end', {
        command: commandId,
        ok: envelope.ok,
        durationMs: envelope.meta.durationMs,
        ...(envelope.ok ? {} : { code: envelope.error.code }),
      }).seq
      return {
        ...envelope,
        meta: { ...envelope.meta, seq },
      }
    }

    if (!command) {
      const suggestions = suggestCommands(commandId, options.commands)
      return finish({
        ok: false,
        command: commandId,
        error: {
          code: 'E_UNKNOWN_COMMAND',
          message: `命令不存在：${commandId}`,
          ...(suggestions.length ? { details: { suggestions } } : {}),
          hint: '可调用 app.help() 或 app.manifest() 查看全部命令',
        },
        meta: buildMeta(startedAt, sinceSeq, seq),
      })
    }

    try {
      const access = command.access ?? 'read'
      if (access === 'write' && options.mode === 'read') {
        throw new MapAiError('E_FORBIDDEN', `只读模式禁止调用写命令：${command.id}`, {
          hint: '使用 ?aiBridge=write 重新打开页面，或设置 localStorage.__map_ai_bridge = "write"',
        })
      }

      const validation = validateParams(command.params, params)
      if (!validation.ok) {
        throw new MapAiError('E_INVALID_PARAMS', `命令 ${command.id} 参数校验失败`, {
          details: validation.errors,
        })
      }

      const data = await command.handler(validation.value, {
        mode: options.mode,
        emit: options.eventLog.emit,
        currentSeq: options.eventLog.currentSeq,
        now,
      })

      const envelope: CallEnvelope<unknown> = {
        ok: true,
        command: command.id,
        data: sanitize(data, command.sanitize),
        meta: buildMeta(startedAt, sinceSeq, seq),
      }
      return finish(envelope)
    } catch (error) {
      const info = toErrorInfo(error)
      return finish({
        ok: false,
        command: command.id,
        error: info,
        meta: buildMeta(startedAt, sinceSeq, seq),
      })
    }
  }

  const runOrThrow = async (command: BridgeCommand, params?: unknown): Promise<unknown> => {
    const result = await invoke(command.id, params)
    if (!result.ok) throw makeError(result.error)
    return result.data
  }

  const root = freezeNamespace(buildNamespace(options.commands, runOrThrow))

  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    options.eventLog.clearSubscribers()
    options.onDispose?.()
  }

  const bridge: MapAiBridge = {
    protocolVersion,
    schemaVersion,
    mode: options.mode,
    modeSource: options.modeSource,
    installedAt,
    help: options.help,
    manifest: options.manifest,
    snapshot: async (snapshotOptions?: SnapshotOptions) =>
      sanitize<SnapshotResult>(await options.snapshot(snapshotOptions), {
        maxStringLength: snapshotOptions?.maxStringLength ?? 20000,
      }),
    call: async <T = unknown>(command: string, params?: unknown) =>
      (await invoke(command, params)) as CallEnvelope<T>,
    dispose,
    events: {
      list: async listOptions => options.eventLog.list(listOptions),
      waitFor: async waitOptions => options.eventLog.waitFor(waitOptions),
    },
    app: (root.app ?? {}) as BridgeNamespace,
    ui: (root.ui ?? {}) as BridgeNamespace,
    auth: (root.auth ?? {}) as BridgeNamespace,
    datasets: (root.datasets ?? {}) as BridgeNamespace,
    markers: (root.markers ?? {}) as BridgeNamespace,
    resources: (root.resources ?? {}) as BridgeNamespace,
    map: (root.map ?? {}) as BridgeNamespace,
    archive: (root.archive ?? {}) as BridgeNamespace,
    forms: (root.forms ?? {}) as BridgeNamespace,
    dev: (root.dev ?? {}) as BridgeNamespace,
  }

  return { bridge, dispose }
}
