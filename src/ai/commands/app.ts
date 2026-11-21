import type {
  BridgeAccess,
  BridgeCommand,
  BridgeManifest,
  ModeSource,
  SnapshotOptions,
} from '@/ai/types'
import {
  AI_BRIDGE_DATA_ATTRIBUTE,
  AI_BRIDGE_GLOBAL_NAME,
  AI_BRIDGE_PROTOCOL_VERSION,
  AI_BRIDGE_SCHEMA_VERSION,
  SNAPSHOT_SECTION_KEYS,
} from '@/ai/constants'
import { objectSchema } from '@/ai/validate'

export interface AppCommandDeps {
  mode: BridgeAccess
  modeSource: ModeSource
  installedAt: number
  getManifest: () => BridgeManifest
  getHelp: (options?: { group?: string }) => string
  snapshot: (options?: SnapshotOptions) => Promise<unknown>
}

/** app.* 命令 */
export const createAppCommands = (deps: AppCommandDeps): BridgeCommand[] => [
  {
    id: 'app.info',
    title: '桥接与应用信息',
    description: '返回协议版本、应用版本、构建信息、URL、桥接模式与来源',
    access: 'read',
    params: objectSchema({}),
    returns: 'Bridge & app info',
    examples: [{ title: '查看桥接状态' }],
    handler: () => ({
      protocolVersion: AI_BRIDGE_PROTOCOL_VERSION,
      schemaVersion: AI_BRIDGE_SCHEMA_VERSION,
      mode: deps.mode,
      modeSource: deps.modeSource,
      installedAt: deps.installedAt,
      ready: true,
      globalName: AI_BRIDGE_GLOBAL_NAME,
      dataAttribute: AI_BRIDGE_DATA_ATTRIBUTE,
      app: {
        title: import.meta.env.VITE_TITLE,
        version: import.meta.env.APP_VERSION ?? '',
        branch: import.meta.env.APP_BRANCH ?? '',
        commitHash: import.meta.env.APP_COMMIT_HASH ?? '',
        mode: import.meta.env.MODE,
        dev: import.meta.env.DEV,
        url: window.location.href,
      },
    }),
  },
  {
    id: 'app.help',
    title: 'Markdown 帮助',
    description: '根据命令注册表生成帮助文档，可按命名空间过滤',
    access: 'read',
    params: objectSchema({
      group: {
        type: 'string',
        description: '按命名空间过滤，如 datasets',
      },
    }),
    returns: 'Markdown 文本',
    examples: [
      { title: '查看全部帮助' },
      { title: '只看数据库命令', params: { group: 'datasets' } },
    ],
    sanitize: { maxStringLength: 200000 },
    handler: params => deps.getHelp({ group: params.group as string | undefined }),
  },
  {
    id: 'app.manifest',
    title: '完整契约',
    description: '返回命令、参数 schema、句柄、事件、错误码与快照 section 的完整 JSON 契约',
    access: 'read',
    params: objectSchema({}),
    returns: 'BridgeManifest',
    examples: [{ title: '读取 manifest' }],
    sanitize: { maxStringLength: 200000 },
    handler: () => deps.getManifest(),
  },
  {
    id: 'app.snapshot',
    title: '应用快照',
    description: '读取登录态、界面句柄、地图、资源、数据库更新、存档、Socket 与表单状态',
    access: 'read',
    params: objectSchema({
      sections: {
        type: 'array',
        items: { type: 'string', enum: SNAPSHOT_SECTION_KEYS },
        description: '只返回指定 section，缺省返回全部',
      },
      includeSurfaceStates: {
        type: 'boolean',
        default: true,
        description: '是否读取句柄内部状态',
      },
      includeWindowStates: {
        type: 'boolean',
        default: true,
        description: '是否读取窗口列表',
      },
      maxStringLength: {
        type: 'number',
        default: 20000,
        minimum: 100,
        maximum: 1000000,
        description: '字符串截断长度',
      },
    }),
    returns: 'SnapshotResult',
    examples: [
      { title: '读取登录/界面/数据库状态', params: { sections: ['auth', 'ui', 'datasets'] } },
    ],
    sanitize: { maxStringLength: 1000000 },
    handler: params => deps.snapshot(params as SnapshotOptions),
  },
  {
    id: 'app.ping',
    title: '连通性检查',
    description: '返回 pong 与当前时间戳',
    access: 'read',
    params: objectSchema({}),
    returns: '{ pong, ts }',
    handler: () => ({ pong: true, ts: Date.now() }),
  },
]
