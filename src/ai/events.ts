import type { EventListOptions, EventRecord, WaitForOptions } from './types'
import { MapAiError } from './errors'
import { sanitize } from './sanitize'

export interface EventLogOptions {
  limit?: number
  now?: () => number
}

export interface EventLog {
  emit: (type: string, payload?: unknown) => EventRecord
  list: (options?: EventListOptions) => EventRecord[]
  waitFor: (options: WaitForOptions) => Promise<EventRecord>
  currentSeq: () => number
  clearSubscribers: () => void
}

interface Waiter {
  type: string
  match: unknown
  sinceSeq: number
  resolve: (record: EventRecord) => void
  reject: (error: Error) => void
  timer?: ReturnType<typeof setTimeout>
}

const DEFAULT_LIMIT = 300
const DEFAULT_WAIT_TIMEOUT = 15000
const MAX_WAIT_TIMEOUT = 300000

/** payload 子集匹配：match 中的每个字段都必须与 payload 相等（对象递归，数组按下标） */
export const matchPayload = (payload: unknown, match: unknown): boolean => {
  if (match === undefined) return true
  if (match === null || typeof match !== 'object') return Object.is(payload, match)

  if (Array.isArray(match)) {
    if (!Array.isArray(payload) || payload.length < match.length) return false
    return match.every((item, index) => matchPayload(payload[index], item))
  }

  if (typeof payload !== 'object' || payload === null) return false
  return Object.entries(match as Record<string, unknown>).every(([key, value]) =>
    matchPayload((payload as Record<string, unknown>)[key], value),
  )
}

/** 创建环形事件日志 */
export const createEventLog = (options: EventLogOptions = {}): EventLog => {
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT)
  const now = options.now ?? Date.now
  const records: EventRecord[] = []
  const waiters = new Set<Waiter>()
  let seq = 0

  const currentSeq = () => seq

  const settle = (waiter: Waiter, record: EventRecord) => {
    if (!waiters.delete(waiter)) return
    if (waiter.timer !== undefined) clearTimeout(waiter.timer)
    waiter.resolve(record)
  }

  const emit = (type: string, payload?: unknown): EventRecord => {
    seq += 1
    let safePayload: unknown
    try {
      safePayload = sanitize(payload)
    } catch {
      safePayload = '[UnserializablePayload]'
    }

    const record: EventRecord = {
      seq,
      ts: now(),
      type,
      payload: safePayload,
    }
    records.push(record)
    if (records.length > limit) records.splice(0, records.length - limit)

    for (const waiter of waiters) {
      if (waiter.type !== type) continue
      if (record.seq <= waiter.sinceSeq) continue
      if (!matchPayload(record.payload, waiter.match)) continue
      settle(waiter, record)
    }

    return record
  }

  const list = (listOptions: EventListOptions = {}): EventRecord[] => {
    const afterSeq = listOptions.afterSeq ?? 0
    const max = Math.max(1, Math.min(limit, listOptions.limit ?? 100))
    return records
      .filter(record => record.seq > afterSeq)
      .filter(record => listOptions.type === undefined || record.type === listOptions.type)
      .slice(-max)
  }

  const waitFor = (waitOptions: WaitForOptions): Promise<EventRecord> => {
    const sinceSeq = waitOptions.sinceSeq ?? currentSeq()
    const existing = records.find(
      record =>
        record.seq > sinceSeq
        && record.type === waitOptions.type
        && matchPayload(record.payload, waitOptions.match),
    )
    if (existing) return Promise.resolve(existing)

    const timeoutMs = Math.min(
      MAX_WAIT_TIMEOUT,
      Math.max(0, waitOptions.timeoutMs ?? DEFAULT_WAIT_TIMEOUT),
    )

    return new Promise<EventRecord>((resolve, reject) => {
      const waiter: Waiter = {
        type: waitOptions.type,
        match: waitOptions.match,
        sinceSeq,
        resolve,
        reject,
      }
      waiter.timer = setTimeout(() => {
        if (!waiters.delete(waiter)) return
        reject(
          new MapAiError('E_TIMEOUT', `等待事件超时：${waitOptions.type}`, {
            details: {
              type: waitOptions.type,
              sinceSeq,
              lastSeq: currentSeq(),
              timeoutMs,
            },
            hint: '可先调用 events.list 查看已经发生的事件，或传入更小的 sinceSeq',
          }),
        )
      }, timeoutMs)
      waiters.add(waiter)
    })
  }

  const clearSubscribers = () => {
    for (const waiter of waiters) {
      waiters.delete(waiter)
      if (waiter.timer !== undefined) clearTimeout(waiter.timer)
      waiter.reject(new MapAiError('E_INTERNAL', '桥接已卸载，事件等待被取消'))
    }
  }

  return {
    emit,
    list,
    waitFor,
    currentSeq,
    clearSubscribers,
  }
}
