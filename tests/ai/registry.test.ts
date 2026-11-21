import { describe, expect, it, vi } from 'vitest'
import type { BridgeCommand, BridgeManifest } from '@/ai/types'
import { createEventLog } from '@/ai/events'
import { MapAiError } from '@/ai/errors'
import { createBridge } from '@/ai/registry'
import { objectSchema } from '@/ai/validate'

const manifest: BridgeManifest = {
  protocol: 'map-ai-bridge',
  protocolVersion: '1.0.0',
  schemaVersion: 1,
  mode: 'write',
  modeSource: 'dev',
  commands: [],
  surfaces: [],
  events: [],
  errorCodes: [],
  snapshotSections: [],
  enablement: {
    query: '?aiBridge=read',
    storage: 'localStorage',
    env: 'VITE_AI_BRIDGE',
    devDefault: 'write',
    prodDefault: 'off',
  },
}

const createDemoCommands = (state: { writeCalled: number }): BridgeCommand[] => [
  {
    id: 'app.ok',
    title: '成功命令',
    description: '返回参数',
    params: objectSchema({ value: { type: 'number' } }, ['value']),
    handler: params => ({ value: params.value }),
  },
  {
    id: 'app.write',
    title: '写命令',
    description: '模拟写操作',
    access: 'write',
    handler: () => {
      state.writeCalled += 1
      return { ok: true }
    },
  },
  {
    id: 'app.error',
    title: '失败命令',
    description: '抛出业务错误',
    handler: () => {
      throw new MapAiError('E_NOT_FOUND', 'not found')
    },
  },
]

const createDemoBridge = (mode: 'read' | 'write' = 'write') => {
  const state = { writeCalled: 0 }
  const eventLog = createEventLog()
  const onDispose = vi.fn()
  const instance = createBridge({
    mode,
    modeSource: 'dev',
    commands: createDemoCommands(state),
    eventLog,
    snapshot: async () => ({
      meta: {
        schemaVersion: 1,
        capturedAt: 0,
        durationMs: 0,
        requestedSections: [],
        failedSections: [],
      },
    }),
    manifest: () => manifest,
    help: () => '# help',
    onDispose,
    now: () => 100,
  })
  return { ...instance, state, eventLog, onDispose }
}

describe('ai/registry', () => {
  it('call 成功返回 envelope 与 meta', async () => {
    const { bridge, eventLog } = createDemoBridge()
    const result = await bridge.call('app.ok', { value: 42 })
    expect(result).toMatchObject({
      ok: true,
      command: 'app.ok',
      data: { value: 42 },
      meta: { startedAt: 100, sinceSeq: 0 },
    })
    expect(result.meta.seq).toBeGreaterThan(0)
    expect(eventLog.list({ type: 'command:end' })).toHaveLength(1)
  })

  it('命名空间直调返回原始数据', async () => {
    const { bridge } = createDemoBridge()
    await expect(bridge.app.ok({ value: 1 })).resolves.toEqual({ value: 1 })
  })

  it('未知命令返回 E_UNKNOWN_COMMAND 而不是抛错', async () => {
    const { bridge } = createDemoBridge()
    const result = await bridge.call('app.nope')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('E_UNKNOWN_COMMAND')
      expect(result.error.details).toEqual({
        suggestions: ['app.ok', 'app.write', 'app.error'],
      })
    }
  })

  it('参数校验失败返回 E_INVALID_PARAMS', async () => {
    const { bridge } = createDemoBridge()
    const result = await bridge.call('app.ok', { value: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('E_INVALID_PARAMS')
      expect(result.error.details).toEqual([{ path: 'value', message: '应为 number 类型' }])
    }
  })

  it('只读模式拒绝写命令且不执行 handler', async () => {
    const { bridge, state } = createDemoBridge('read')
    const result = await bridge.call('app.write')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('E_FORBIDDEN')
    expect(state.writeCalled).toBe(0)
  })

  it('业务错误被转换为 E_DOMAIN 信息', async () => {
    const { bridge } = createDemoBridge()
    const result = await bridge.call('app.error')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatchObject({ code: 'E_NOT_FOUND', message: 'not found' })
    }
  })

  it('重复命令 id 在创建时抛错', () => {
    const eventLog = createEventLog()
    expect(() =>
      createBridge({
        mode: 'write',
        modeSource: 'dev',
        commands: [
          ...createDemoCommands({ writeCalled: 0 }),
          {
            id: 'app.ok',
            title: '重复',
            description: '重复',
            handler: () => null,
          },
        ],
        eventLog,
        snapshot: async () => ({ meta: {} }) as never,
        manifest: () => manifest,
        help: () => '',
      }),
    ).toThrow('重复的命令 id')
  })

  it('snapshot / manifest / help / dispose 正常', async () => {
    const { bridge, onDispose } = createDemoBridge()
    await expect(bridge.snapshot()).resolves.toMatchObject({ meta: { schemaVersion: 1 } })
    expect(bridge.manifest()).toBe(manifest)
    expect(bridge.help()).toBe('# help')
    bridge.dispose()
    expect(onDispose).toHaveBeenCalledTimes(1)
    bridge.dispose()
    expect(onDispose).toHaveBeenCalledTimes(1)
  })
})
