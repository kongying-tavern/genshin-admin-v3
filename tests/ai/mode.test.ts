import { describe, expect, it } from 'vitest'
import { normalizeBridgeMode, resolveBridgeMode } from '@/ai/mode'

describe('ai/mode', () => {
  it('归一化识别 read / write / off', () => {
    expect(normalizeBridgeMode('1')).toBe('read')
    expect(normalizeBridgeMode('read')).toBe('read')
    expect(normalizeBridgeMode('2')).toBe('write')
    expect(normalizeBridgeMode('rw')).toBe('write')
    expect(normalizeBridgeMode('0')).toBe('off')
    expect(normalizeBridgeMode('nope')).toBeUndefined()
    expect(normalizeBridgeMode('')).toBeUndefined()
  })

  it('URL query 优先于 storage / env / 默认值', () => {
    const result = resolveBridgeMode({
      search: '?aiBridge=read',
      storageValue: 'write',
      envValue: 'write',
      isDev: true,
    })
    expect(result).toEqual({ mode: 'read', source: 'query' })
  })

  it('没有 query 时使用 storage', () => {
    const result = resolveBridgeMode({
      search: '',
      storageValue: 'off',
      envValue: 'write',
      isDev: true,
    })
    expect(result).toEqual({ mode: 'off', source: 'storage' })
  })

  it('没有 query/storage 时使用 env', () => {
    const result = resolveBridgeMode({
      search: '',
      storageValue: null,
      envValue: 'read',
      isDev: true,
    })
    expect(result).toEqual({ mode: 'read', source: 'env' })
  })

  it('开发环境默认 write，生产默认 off', () => {
    expect(resolveBridgeMode({ search: '', storageValue: null, isDev: true })).toEqual({
      mode: 'write',
      source: 'dev',
    })
    expect(resolveBridgeMode({ search: '', storageValue: null, isDev: false })).toEqual({
      mode: 'off',
      source: 'default',
    })
  })

  it('非法 query 会回退到 storage', () => {
    const result = resolveBridgeMode({
      search: '?aiBridge=whatever',
      storageValue: 'read',
      isDev: true,
    })
    expect(result).toEqual({ mode: 'read', source: 'storage' })
  })
})
