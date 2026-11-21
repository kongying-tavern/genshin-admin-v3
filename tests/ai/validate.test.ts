import { describe, expect, it } from 'vitest'
import { objectSchema, toJsonSchema, validateParams } from '@/ai/validate'

describe('ai/validate', () => {
  const schema = objectSchema(
    {
      key: { type: 'string', enum: ['marker', 'item'] },
      page: { type: 'number', default: 1, minimum: 1 },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 2 },
      nested: {
        type: 'object',
        properties: { flag: { type: 'boolean' } },
        required: ['flag'],
        additionalProperties: false,
      },
    },
    ['key'],
  )

  it('填充默认值并通过校验', () => {
    const result = validateParams(schema, { key: 'marker', nested: { flag: true } })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        key: 'marker',
        page: 1,
        nested: { flag: true },
      })
    }
  })

  it('缺少必填参数时返回路径', () => {
    const result = validateParams(schema, { nested: { flag: true } })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toEqual([{ path: 'key', message: '缺少必填参数' }])
    }
  })

  it('识别未知参数、枚举与范围错误', () => {
    const result = validateParams(schema, {
      key: 'other',
      page: 0,
      unknown: 1,
      nested: { flag: 1 },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.map(item => item.path).sort()).toEqual(
        ['key', 'nested.flag', 'page', 'unknown'].sort(),
      )
    }
  })

  it('校验数组项数量与项类型', () => {
    const result = validateParams(schema, {
      key: 'marker',
      tags: ['a', 'b', 'c'],
      nested: { flag: true },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toEqual({ path: 'tags', message: '最多允许 2 项' })
    }
  })

  it('无 schema 时允许空参数，但拒绝非对象', () => {
    expect(validateParams(undefined, undefined)).toEqual({ ok: true, value: {} })
    expect(validateParams(undefined, { a: 1 })).toEqual({ ok: true, value: { a: 1 } })
    expect(validateParams(undefined, 'x').ok).toBe(false)
  })

  it('转换为 JSON schema', () => {
    const json = toJsonSchema(schema)
    expect(json).toMatchObject({
      type: 'object',
      required: ['key'],
      additionalProperties: false,
    })
    expect((json.properties as Record<string, unknown>).key).toMatchObject({
      type: 'string',
      enum: ['marker', 'item'],
    })
  })
})
