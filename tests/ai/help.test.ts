import { describe, expect, it } from 'vitest'
import type { BridgeCommand, SurfaceInfo } from '@/ai/types'
import { buildHelp, buildManifest } from '@/ai/help'
import { objectSchema } from '@/ai/validate'

const commands: BridgeCommand[] = [
  {
    id: 'app.info',
    title: '信息',
    description: '返回信息',
    params: objectSchema({}),
    handler: () => ({}),
  },
  {
    id: 'datasets.update',
    title: '更新',
    description: '触发更新',
    access: 'write',
    tags: ['network'],
    params: objectSchema({ key: { type: 'string' } }, ['key']),
    handler: () => ({}),
  },
]

const surfaces: SurfaceInfo[] = [
  {
    id: 'settings',
    kind: 'dialog',
    title: '系统设置',
    description: '设置弹窗',
    available: true,
    open: false,
  },
  {
    id: 'window.itemManager',
    kind: 'window',
    title: '物品管理',
    available: false,
  },
]

const input = {
  mode: 'read' as const,
  modeSource: 'query' as const,
  protocolVersion: '1.0.0',
  schemaVersion: 1,
  commands,
  surfaces,
  snapshotSections: ['app', 'auth'] as const,
  events: ['bridge:ready', 'command:end', 'dataset:update-start'] as const,
}

describe('ai/help', () => {
  it('生成命令、句柄、错误码与启用矩阵', () => {
    const manifest = buildManifest(input)

    expect(manifest.protocol).toBe('map-ai-bridge')
    expect(manifest.mode).toBe('read')
    expect(manifest.modeSource).toBe('query')
    expect(manifest.commands).toHaveLength(2)
    expect(manifest.commands.find(item => item.id === 'datasets.update')).toMatchObject({
      access: 'write',
      allowed: false,
      tags: ['network'],
    })
    expect(manifest.commands.find(item => item.id === 'app.info')?.allowed).toBe(true)
    expect(manifest.surfaces.find(item => item.id === 'window.itemManager')?.available).toBe(false)
    expect(manifest.errorCodes.some(item => item.code === 'E_FORBIDDEN')).toBe(true)
    expect(manifest.snapshotSections).toEqual(['app', 'auth'])
    expect(manifest.enablement.query).toContain('aiBridge')
  })

  it('帮助文本包含命令、句柄、事件与常用流程', () => {
    const help = buildHelp(buildManifest(input))
    expect(help).toContain('# 空荧后厨 AI 页面句柄')
    expect(help).toContain('datasets.update')
    expect(help).toContain('window.itemManager')
    expect(help).toContain('dataset:update-start')
    expect(help).toContain('常用流程')
    expect(help).toContain('E_FORBIDDEN')
  })

  it('支持按命名空间过滤', () => {
    const help = buildHelp(buildManifest(input), { group: 'datasets' })
    expect(help).toContain('datasets.update')
    expect(help).not.toContain('app.info')
    expect(help).not.toContain('## 页面句柄')
  })
})
