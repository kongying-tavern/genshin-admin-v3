import { describe, expect, it } from 'vitest'
import { createEventLog, matchPayload } from '@/ai/events'

describe('ai/events', () => {
  it('seq 单调递增并按容量淘汰', () => {
    const log = createEventLog({ limit: 3, now: () => 100 })
    log.emit('a', { index: 1 })
    log.emit('a', { index: 2 })
    log.emit('b', { index: 3 })
    log.emit('b', { index: 4 })

    expect(log.currentSeq()).toBe(4)
    const records = log.list()
    expect(records.map(item => item.seq)).toEqual([2, 3, 4])
    expect(records[0].ts).toBe(100)
  })

  it('支持 afterSeq / type / limit', () => {
    const log = createEventLog()
    log.emit('a', { index: 1 })
    log.emit('b', { index: 2 })
    log.emit('a', { index: 3 })

    expect(log.list({ type: 'a' }).map(item => item.seq)).toEqual([1, 3])
    expect(log.list({ afterSeq: 1 }).map(item => item.seq)).toEqual([2, 3])
    expect(log.list({ limit: 1 }).map(item => item.seq)).toEqual([3])
  })

  it('match 对 payload 做子集匹配', () => {
    expect(matchPayload({ key: 'marker', status: 'success' }, { key: 'marker' })).toBe(true)
    expect(matchPayload({ key: 'item' }, { key: 'marker' })).toBe(false)
    expect(matchPayload({ list: [1, 2, 3] }, { list: [1, 2] })).toBe(true)
    expect(matchPayload(null, {})).toBe(false)
  })

  it('waitFor 等待未来事件', async () => {
    const log = createEventLog()
    const promise = log.waitFor({
      type: 'dataset:update-end',
      match: { key: 'marker' },
      timeoutMs: 1000,
    })
    log.emit('dataset:update-end', { key: 'marker', status: 'success' })
    await expect(promise).resolves.toMatchObject({
      type: 'dataset:update-end',
      payload: { key: 'marker', status: 'success' },
    })
  })

  it('waitFor 可通过 sinceSeq 命中历史事件', async () => {
    const log = createEventLog()
    log.emit('auth:login', { userId: 1 })
    await expect(log.waitFor({ type: 'auth:login', sinceSeq: 0 })).resolves.toMatchObject({
      payload: { userId: 1 },
    })
  })

  it('waitFor 超时抛出 E_TIMEOUT', async () => {
    const log = createEventLog()
    await expect(log.waitFor({ type: 'never', timeoutMs: 20 })).rejects.toMatchObject({
      code: 'E_TIMEOUT',
    })
  })

  it('clearSubscribers 取消挂起的等待', async () => {
    const log = createEventLog()
    const promise = log.waitFor({ type: 'never', timeoutMs: 10_000 })
    log.clearSubscribers()
    await expect(promise).rejects.toMatchObject({ code: 'E_INTERNAL' })
  })
})
