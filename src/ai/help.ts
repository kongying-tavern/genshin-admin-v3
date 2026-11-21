import type {
  BridgeCommand,
  BridgeManifest,
  BridgeMode,
  ErrorCode,
  ManifestCommand,
  ModeSource,
  SnapshotSectionKey,
  SurfaceInfo,
} from './types'
import {
  AI_BRIDGE_DEV_DEFAULT,
  AI_BRIDGE_PROD_DEFAULT,
  AI_BRIDGE_QUERY_KEY,
  AI_BRIDGE_STORAGE_KEY,
} from './constants'
import { ERROR_CODE_DESCRIPTIONS } from './errors'
import { toJsonSchema } from './validate'

export interface ManifestInput {
  mode: 'read' | 'write'
  modeSource: ModeSource
  protocolVersion: string
  schemaVersion: number
  commands: BridgeCommand[]
  surfaces: SurfaceInfo[]
  snapshotSections: readonly SnapshotSectionKey[]
  events: readonly string[]
}

const toManifestCommand = (command: BridgeCommand, mode: 'read' | 'write'): ManifestCommand => {
  const access = command.access ?? 'read'
  return {
    id: command.id,
    title: command.title,
    description: command.description,
    access,
    ...(command.tags ? { tags: command.tags } : {}),
    params: command.params ? toJsonSchema(command.params) : { type: 'object', properties: {} },
    ...(command.returns ? { returns: command.returns } : {}),
    ...(command.examples ? { examples: command.examples } : {}),
    allowed: access === 'read' || mode === 'write',
  }
}

/** 构建 manifest */
export const buildManifest = (input: ManifestInput): BridgeManifest => ({
  protocol: 'map-ai-bridge',
  protocolVersion: input.protocolVersion,
  schemaVersion: input.schemaVersion,
  mode: input.mode,
  modeSource: input.modeSource,
  commands: input.commands.map(command => toManifestCommand(command, input.mode)),
  surfaces: input.surfaces.map(surface => ({
    id: surface.id,
    kind: surface.kind,
    title: surface.title,
    ...(surface.description ? { description: surface.description } : {}),
    available: surface.available,
  })),
  events: [...input.events],
  errorCodes: (Object.keys(ERROR_CODE_DESCRIPTIONS) as ErrorCode[]).map(code => ({
    code,
    description: ERROR_CODE_DESCRIPTIONS[code],
  })),
  snapshotSections: [...input.snapshotSections],
  enablement: {
    query: `?${AI_BRIDGE_QUERY_KEY}=read|write|off`,
    storage: `localStorage['${AI_BRIDGE_STORAGE_KEY}'] = 'read' | 'write' | 'off'`,
    env: 'VITE_AI_BRIDGE=read|write|off',
    devDefault: AI_BRIDGE_DEV_DEFAULT,
    prodDefault: AI_BRIDGE_PROD_DEFAULT,
  },
})

const paramsSummary = (params: unknown): string => {
  if (typeof params !== 'object' || params === null) return '—'
  const properties = (params as { properties?: Record<string, unknown> }).properties ?? {}
  const required = new Set((params as { required?: readonly string[] }).required ?? [])
  const keys = Object.keys(properties)
  if (!keys.length) return '—'
  return keys.map(key => (required.has(key) ? key : `${key}?`)).join(', ')
}

const groupCommands = (commands: ManifestCommand[]): Map<string, ManifestCommand[]> => {
  const groups = new Map<string, ManifestCommand[]>()
  for (const command of commands) {
    const group = command.id.split('.')[0]
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(command)
  }
  return groups
}

const COMMON_RECIPES = `## 常用流程（在页面上下文中执行）

\`\`\`js
// 1. 查看全局状态
await __MAP_AI__.call('app.info')
await __MAP_AI__.call('app.snapshot', { sections: ['auth', 'ui', 'datasets'] })

// 2. 登录（开发环境可省略参数，使用 VITE_AUTO_COMPLETE_*）
await __MAP_AI__.call('auth.login', { username: '...', password: '...' })

// 3. 打开设置弹窗并定位到数据库页签，读取六类本地数据更新状态
await __MAP_AI__.call('ui.surfaces.open', {
  id: 'settings',
  params: { section: 'database' },
})
await __MAP_AI__.call('datasets.list')

// 4. 触发点位数据库差异更新并等待结束
const started = await __MAP_AI__.call('datasets.update', { key: 'marker' })
await __MAP_AI__.events.waitFor({
  type: 'dataset:update-end',
  match: { key: 'marker' },
  sinceSeq: started.data.sinceSeq,
  timeoutMs: 120000,
})

// 5. 打开点位弹窗 / 编辑表单
await __MAP_AI__.call('markers.focus', { id: 123 })
await __MAP_AI__.call('ui.surfaces.open', { id: 'markerEditor', params: { markerId: 123 } })
await __MAP_AI__.call('forms.get', { id: 'markerEditor' })
await __MAP_AI__.call('forms.close', { id: 'markerEditor' })
\`\`\`
`

/** 构建 Markdown 帮助 */
export const buildHelp = (manifest: BridgeManifest, options: { group?: string } = {}): string => {
  const group = options.group?.trim()
  const commands = group
    ? manifest.commands.filter(command => command.id.startsWith(`${group}.`))
    : manifest.commands
  const groups = groupCommands(commands)
  const lines: string[] = []

  lines.push('# 空荧后厨 AI 页面句柄')
  lines.push('')
  lines.push(
    `当前模式：**${manifest.mode}**（来源：${manifest.modeSource}），协议版本：${manifest.protocolVersion}。`,
  )
  lines.push('')
  lines.push('## 启用方式')
  lines.push('')
  lines.push(`- URL：\`${manifest.enablement.query}\`（仅本次加载）`)
  lines.push(`- 持久化：\`${manifest.enablement.storage}\``)
  lines.push(`- 构建变量：\`${manifest.enablement.env}\``)
  lines.push(
    `- 默认值：开发环境 \`${manifest.enablement.devDefault}\`，生产环境 \`${manifest.enablement.prodDefault}\``,
  )
  lines.push('')
  lines.push('## 两种调用方式')
  lines.push('')
  lines.push(
    '- 安全 RPC：`await __MAP_AI__.call(command, params)`，返回 `{ ok, data | error, meta }`，不抛异常。',
  )
  lines.push('- 命名空间：`await __MAP_AI__.datasets.list()`，直接返回数据，失败抛错。')
  lines.push('')
  lines.push('## 命令')
  lines.push('')

  for (const [groupName, list] of groups) {
    lines.push(`### ${groupName}`)
    lines.push('')
    lines.push('| 命令 | 级别 | 参数 | 说明 |')
    lines.push('| --- | --- | --- | --- |')
    for (const command of list) {
      const allowed = command.allowed ? command.access : `${command.access}（当前禁止）`
      lines.push(
        `| \`${command.id}\` | ${allowed} | ${paramsSummary(command.params)} | ${command.description} |`,
      )
    }
    lines.push('')
  }

  if (!group) {
    lines.push('## 页面句柄')
    lines.push('')
    lines.push('| id | 类型 | 说明 | 可用 |')
    lines.push('| --- | --- | --- | --- |')
    for (const surface of manifest.surfaces) {
      lines.push(
        `| \`${surface.id}\` | ${surface.kind} | ${surface.description ?? surface.title} | ${surface.available ? '是' : '否'} |`,
      )
    }
    lines.push('')
    lines.push('## 事件')
    lines.push('')
    lines.push(manifest.events.map(type => `\`${type}\``).join('、'))
    lines.push('')
    lines.push('使用 `events.waitFor({ type, match, sinceSeq, timeoutMs })` 等待异步任务。')
    lines.push('')
    lines.push('## 快照 section')
    lines.push('')
    lines.push(manifest.snapshotSections.map(key => `\`${key}\``).join('、'))
    lines.push('')
    lines.push(COMMON_RECIPES)
  }

  lines.push('## 错误码')
  lines.push('')
  lines.push('| code | 说明 |')
  lines.push('| --- | --- |')
  for (const item of manifest.errorCodes) {
    lines.push(`| \`${item.code}\` | ${item.description} |`)
  }
  lines.push('')
  lines.push(
    '提示：页面启动期间可通过 `document.documentElement.dataset.aiBridge` 判断状态（booting/read/write/error）。',
  )
  lines.push('')

  return lines.join('\n')
}

/** 供 manifest 使用的默认快照 section 列表类型守卫 */
export const isBridgeMode = (value: unknown): value is BridgeMode =>
  value === 'off' || value === 'read' || value === 'write'
