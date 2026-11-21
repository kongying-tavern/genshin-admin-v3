import type { SanitizeOptions } from './types'
import { isRef, toRaw } from 'vue'

const DEFAULT_OPTIONS: Required<Omit<SanitizeOptions, 'redactKeys'>> & {
  redactKeys: readonly string[]
} = {
  maxDepth: 6,
  maxArrayLength: 200,
  maxObjectKeys: 100,
  maxStringLength: 20000,
  redactKeys: [],
}

/** 始终脱敏的键名 */
const BUILT_IN_SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'clientsecret',
  'apikey',
  'api_key',
])

const UINT32_BASE = 0x100000000

interface LongLike {
  low: number
  high: number
  unsigned?: boolean
  toNumber?: () => number
}

const isLongLike = (value: unknown): value is LongLike =>
  typeof value === 'object'
  && value !== null
  && 'low' in value
  && 'high' in value
  && typeof (value as LongLike).low === 'number'
  && typeof (value as LongLike).high === 'number'

/** 与 protobuf toNumber 一致的长整型收敛 */
const longToNumber = (value: LongLike): number => {
  if (typeof value.toNumber === 'function') {
    const next = value.toNumber()
    if (Number.isFinite(next)) return next
  }
  const low = value.low >>> 0
  if (value.unsigned === false) return (value.high | 0) * UINT32_BASE + low
  return (value.high >>> 0) * UINT32_BASE + low
}

const truncateString = (value: string, maxLength: number) => {
  if (maxLength <= 0 || value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}…[truncated]`
}

const isSensitiveKey = (key: string, extraKeys: readonly string[]) => {
  const normalized = key.toLowerCase()
  if (BUILT_IN_SENSITIVE_KEYS.has(normalized)) return true
  return extraKeys.some(item => item.toLowerCase() === normalized)
}

const isDomNode = (value: object): boolean => {
  if (typeof Node === 'undefined') return false
  return value instanceof Node
}

/**
 * 将任意值转换为可 JSON 序列化的纯数据。
 *
 * - Vue Ref / reactive / Map / Set / Long / Date / Error 均会被展开
 * - 超长字符串、超长数组、过深对象会被截断并标记
 * - 敏感键会被替换为 `***`
 */
export const sanitize = <T = unknown>(input: unknown, options: SanitizeOptions = {}): T => {
  const maxDepth = options.maxDepth ?? DEFAULT_OPTIONS.maxDepth
  const maxArrayLength = options.maxArrayLength ?? DEFAULT_OPTIONS.maxArrayLength
  const maxObjectKeys = options.maxObjectKeys ?? DEFAULT_OPTIONS.maxObjectKeys
  const maxStringLength = options.maxStringLength ?? DEFAULT_OPTIONS.maxStringLength
  const redactKeys = [...DEFAULT_OPTIONS.redactKeys, ...(options.redactKeys ?? [])]

  const seen = new WeakSet<object>()

  const walk = (value: unknown, depth: number): unknown => {
    if (value === null || value === undefined) return null

    if (typeof value === 'string') return truncateString(value, maxStringLength)
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') {
      if (Number.isNaN(value)) return 'NaN'
      if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity'
      return value
    }
    if (typeof value === 'bigint') return value.toString()
    if (typeof value === 'symbol') return value.toString()
    if (typeof value === 'function') return `[Function:${value.name || 'anonymous'}]`

    if (isRef(value)) return walk(value.value, depth)

    const raw = toRaw(value)

    if (raw instanceof Date) return raw.toISOString()
    if (raw instanceof Error) {
      return {
        name: raw.name,
        message: raw.message,
        ...(raw.stack ? { stack: truncateString(raw.stack, maxStringLength) } : {}),
      }
    }
    if (raw instanceof Promise) return '[Promise]'
    if (raw instanceof WeakMap || raw instanceof WeakSet) return '[WeakCollection]'
    if (typeof ArrayBuffer !== 'undefined' && raw instanceof ArrayBuffer) {
      return `[ArrayBuffer:${raw.byteLength}]`
    }
    if (isLongLike(raw)) return longToNumber(raw)
    if (isDomNode(raw as object)) return '[DomNode]'

    if (typeof raw !== 'object') return String(raw)

    if (seen.has(raw)) return '[Circular]'
    if (depth >= maxDepth) return '[MaxDepth]'
    seen.add(raw)

    if (raw instanceof Map) {
      const entries: [unknown, unknown][] = []
      let index = 0
      for (const [key, item] of raw) {
        if (index >= maxArrayLength) {
          return { __truncatedMap: true, total: raw.size, entries }
        }
        entries.push([walk(key, depth + 1), walk(item, depth + 1)])
        index += 1
      }
      const isPrimitiveKey = entries.every(
        ([key]) => typeof key === 'string' || typeof key === 'number',
      )
      if (isPrimitiveKey) {
        return Object.fromEntries(entries as [string | number, unknown][])
      }
      return { __entries: entries }
    }

    if (raw instanceof Set) {
      const items: unknown[] = []
      let index = 0
      for (const item of raw) {
        if (index >= maxArrayLength) {
          return { __truncatedArray: true, total: raw.size, items }
        }
        items.push(walk(item, depth + 1))
        index += 1
      }
      return items
    }

    if (Array.isArray(raw)) {
      if (raw.length > maxArrayLength) {
        return {
          __truncatedArray: true,
          total: raw.length,
          items: raw.slice(0, maxArrayLength).map(item => walk(item, depth + 1)),
        }
      }
      return raw.map(item => walk(item, depth + 1))
    }

    const keys = Object.keys(raw)
    const entries = keys.slice(0, maxObjectKeys).map(key => {
      if (isSensitiveKey(key, redactKeys)) return [key, '***'] as const
      try {
        return [key, walk((raw as Record<string, unknown>)[key], depth + 1)] as const
      } catch {
        return [key, '[GetterError]'] as const
      }
    })
    const result = Object.fromEntries(entries) as Record<string, unknown>
    if (keys.length > maxObjectKeys) result.__truncated = true
    return result
  }

  return walk(input, 0) as T
}

/** 仅做脱敏，不额外改变结构（仍会做 JSON 收敛） */
export const redact = (input: unknown, redactKeys: readonly string[]): unknown =>
  sanitize(input, { redactKeys, maxDepth: 8, maxArrayLength: 100, maxObjectKeys: 100 })
