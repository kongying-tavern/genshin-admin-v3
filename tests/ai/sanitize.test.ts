import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { sanitize } from '@/ai/sanitize'

describe('ai/sanitize', () => {
  it('展开 Ref / Map / Set / Long / Date / Error', () => {
    const result = sanitize({
      refValue: ref(1),
      primitiveMap: new Map<string, unknown>([
        ['a', 1],
        ['b', 2],
      ]),
      objectMap: new Map<unknown, unknown>([[{ id: 1 }, 'x']]),
      set: new Set([1, 2]),
      long: { low: 1, high: 0, unsigned: true },
      date: new Date('2020-01-01T00:00:00.000Z'),
      error: new Error('boom'),
    }) as Record<string, unknown>

    expect(result.refValue).toBe(1)
    expect(result.primitiveMap).toEqual({ a: 1, b: 2 })
    expect(result.objectMap).toEqual({ __entries: [[{ id: 1 }, 'x']] })
    expect(result.set).toEqual([1, 2])
    expect(result.long).toBe(1)
    expect(result.date).toBe('2020-01-01T00:00:00.000Z')
    expect(result.error).toMatchObject({ name: 'Error', message: 'boom' })
  })

  it('脱敏敏感键', () => {
    const result = sanitize({
      username: 'alice',
      password: 'secret',
      accessToken: 'token-value',
      nested: { refreshToken: 'refresh', normal: 'ok' },
    }) as Record<string, unknown>

    expect(result.username).toBe('alice')
    expect(result.password).toBe('***')
    expect(result.accessToken).toBe('***')
    expect((result.nested as Record<string, unknown>).refreshToken).toBe('***')
    expect((result.nested as Record<string, unknown>).normal).toBe('ok')
  })

  it('支持额外脱敏键', () => {
    const result = sanitize({ pin: '1234', normal: 'ok' }, { redactKeys: ['pin'] }) as Record<
      string,
      unknown
    >
    expect(result.pin).toBe('***')
    expect(result.normal).toBe('ok')
  })

  it('处理循环引用', () => {
    const source: Record<string, unknown> = { name: 'root' }
    source.self = source
    const result = sanitize(source) as Record<string, unknown>
    expect(result.name).toBe('root')
    expect(result.self).toBe('[Circular]')
  })

  it('截断字符串、数组与过深对象', () => {
    const array = Array.from({ length: 10 }, (_, index) => index)
    const result = sanitize(
      {
        text: 'abcdefghij',
        array,
        deep: { a: { b: { c: { d: { e: 1 } } } } },
      },
      { maxStringLength: 4, maxArrayLength: 3, maxDepth: 3 },
    ) as Record<string, unknown>

    expect(result.text).toBe('abcd…[truncated]')
    expect(result.array).toEqual({ __truncatedArray: true, total: 10, items: [0, 1, 2] })
    expect(JSON.stringify(result.deep)).toContain('[MaxDepth]')
  })

  it('结果始终可 JSON 序列化', () => {
    const result = sanitize({
      fn: () => 1,
      bigint: 10n,
      symbol: Symbol('x'),
      nan: Number.NaN,
      infinity: Number.POSITIVE_INFINITY,
      undef: undefined,
      arr: [undefined, 1],
    })
    expect(() => JSON.stringify(result)).not.toThrow()
    expect(result).toMatchObject({
      fn: '[Function:fn]',
      bigint: '10',
      nan: 'NaN',
      infinity: 'Infinity',
      arr: [null, 1],
    })
  })
})
