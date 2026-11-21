import type { BridgeMode, ModeSource } from './types'
import {
  AI_BRIDGE_DEV_DEFAULT,
  AI_BRIDGE_PROD_DEFAULT,
  AI_BRIDGE_QUERY_KEY,
  AI_BRIDGE_STORAGE_KEY,
} from './constants'

/** 归一化输入，无法识别时返回 undefined */
export const normalizeBridgeMode = (raw: string | null | undefined): BridgeMode | undefined => {
  const value = raw?.trim().toLowerCase()
  if (!value) return undefined
  if (['1', 'on', 'true', 'read', 'query', 'ro', 'readonly'].includes(value)) return 'read'
  if (['2', 'write', 'rw', 'full', 'readwrite'].includes(value)) return 'write'
  if (['0', 'off', 'false', 'none', 'disabled'].includes(value)) return 'off'
  return undefined
}

export interface ModeResolveInput {
  /** 同 location.search，默认读取当前页面 */
  search?: string
  /** localStorage 中保存的原始值 */
  storageValue?: string | null
  /** VITE_AI_BRIDGE 原始值 */
  envValue?: string | undefined
  /** 是否开发环境 */
  isDev?: boolean
}

export interface ModeResolveResult {
  mode: BridgeMode
  source: ModeSource
}

const readCurrentInput = (): ModeResolveInput => {
  let search = ''
  try {
    search = location.search
  } catch {
    // 非浏览器环境忽略
  }

  let storageValue: string | null = null
  try {
    storageValue = localStorage.getItem(AI_BRIDGE_STORAGE_KEY)
  } catch {
    // 隐私模式 / 非浏览器环境忽略
  }

  return {
    search,
    storageValue,
    envValue: import.meta.env.VITE_AI_BRIDGE,
    isDev: import.meta.env.DEV,
  }
}

/** 解析 URL query 中的模式 */
const resolveQueryMode = (search = '') => {
  try {
    return normalizeBridgeMode(new URLSearchParams(search).get(AI_BRIDGE_QUERY_KEY))
  } catch {
    return undefined
  }
}

/**
 * 解析桥接模式。
 *
 * 优先级：URL query > localStorage > VITE_AI_BRIDGE > 开发/生产默认值
 */
export const resolveBridgeMode = (
  input: ModeResolveInput = readCurrentInput(),
): ModeResolveResult => {
  const queryMode = resolveQueryMode(input.search)
  if (queryMode) return { mode: queryMode, source: 'query' }

  const storageMode = normalizeBridgeMode(input.storageValue)
  if (storageMode) return { mode: storageMode, source: 'storage' }

  const envMode = normalizeBridgeMode(input.envValue)
  if (envMode) return { mode: envMode, source: 'env' }

  if (input.isDev) return { mode: AI_BRIDGE_DEV_DEFAULT, source: 'dev' }
  return { mode: AI_BRIDGE_PROD_DEFAULT, source: 'default' }
}
