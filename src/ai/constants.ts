import type { BridgeMode, SnapshotSectionKey } from './types'
import { AI_BRIDGE_MODE_KEY } from '@/shared/localStorageKey'

/** 全局对象名 */
export const AI_BRIDGE_GLOBAL_NAME = '__MAP_AI__'

/** 协议版本 */
export const AI_BRIDGE_PROTOCOL_VERSION = '1.0.0'

/** schema 版本 */
export const AI_BRIDGE_SCHEMA_VERSION = 1

/** URL query 参数名 */
export const AI_BRIDGE_QUERY_KEY = 'aiBridge'

/** 启动状态写入的 DOM 属性名（data-ai-bridge） */
export const AI_BRIDGE_DATA_ATTRIBUTE = 'aiBridge'

/** 事件环形缓冲容量 */
export const AI_BRIDGE_EVENT_LIMIT = 300

/** 开发环境默认模式 */
export const AI_BRIDGE_DEV_DEFAULT: BridgeMode = 'write'

/** 生产环境默认模式 */
export const AI_BRIDGE_PROD_DEFAULT: BridgeMode = 'off'

/** localStorage 键名 */
export const AI_BRIDGE_STORAGE_KEY = AI_BRIDGE_MODE_KEY

/** v1 快照 section */
export const SNAPSHOT_SECTION_KEYS: readonly SnapshotSectionKey[] = [
  'app',
  'auth',
  'ui',
  'map',
  'resources',
  'datasets',
  'archive',
  'socket',
  'forms',
]

/** v1 事件类型 */
export const AI_BRIDGE_EVENT_TYPES = [
  'bridge:ready',
  'command:end',
  'surface:open',
  'surface:close',
  'form:submitted',
  'form:succeeded',
  'form:failed',
  'auth:login',
  'auth:logout',
  'dataset:update-start',
  'dataset:update-phase',
  'dataset:update-end',
  'socket:status',
  'notice:open',
  'notice:close',
  'window:change',
  'runtime:error',
] as const
