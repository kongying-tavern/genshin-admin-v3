import { createHash } from 'node:crypto'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 单元测试：系统订阅配置 store（`src/stores/dadian.ts`）
 *
 * 覆盖订阅配置的落地逻辑：
 * - 通过接口获取归档 → 解压 → 以 SHA-256 摘要为 key 写入本地缓存
 * - 对外暴露的 `raw` / `meta` / 名片列表等派生值
 * - 版本号取 tiles / tilesBeta 的 base0 code，缺失时回退为 `-NA-`
 * - 登录角色变化时自动刷新
 * - 请求或解压失败时不污染缓存与现有数据
 *
 * 网络与解压过程由替身提供，真实归档的完整性由
 * `tests/api/integration/system-config.test.ts` 覆盖。
 */

const mocks = vi.hoisted(() => ({
  getSystemConfig: vi.fn(),
  decompressAs: vi.fn(),
  clear: vi.fn(),
  put: vi.fn(),
  validateDadianJSON: vi.fn(),
}))

/** 可切换角色的登录态替身 */
const userSession = vi.hoisted(() => ({
  info: { roleId: 1 } as { roleId?: number },
}))

vi.mock('@/api/config', () => ({
  getSystemConfig: mocks.getSystemConfig,
  default: { getSystemConfig: mocks.getSystemConfig },
}))

vi.mock('@/configs', () => ({
  validateDadianJSON: mocks.validateDadianJSON,
}))

vi.mock('@/database', () => ({
  cache: {
    systemConfig: {
      clear: mocks.clear,
      put: mocks.put,
    },
  },
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => userSession,
}))

vi.mock('@/utils', () => ({
  Zip: { decompressAs: mocks.decompressAs },
  messageFrom: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
}))

/** 使用真实的 useFetchHook，只替换它依赖的下游模块 */
vi.mock('@/hooks', async () => {
  const { useFetchHook } = await import('@/hooks/useFetch')
  return { useFetchHook }
})

/** 归档原始字节（内容无关紧要，摘要按原样计算） */
const rawBytes = new Uint8Array([0x42, 0x5a, 0x68, 0x39, 0x31, 0x41, 0x59, 0x26])

const rawBuffer = () => rawBytes.slice().buffer

const defaultConfig: DTO.DadianJSON = {
  tiles: { '提瓦特-base0': { code: 'twt702' } },
  tilesBeta: { '提瓦特-base0': { code: 'twt703' } },
  application: {
    nameCard: [
      { label: '名片A', icon: 'a.png' },
      { icon: 'no-label.png' },
    ],
  },
}

/** 与 store 内实现一致的摘要算法 */
const expectedDigest = createHash('sha256').update(rawBytes).digest('hex')

describe('系统订阅配置 store', () => {
  let useDadianStore: (typeof import('@/stores/dadian'))['useDadianStore']

  beforeEach(async () => {
    setActivePinia(createPinia())
    userSession.info = reactive({ roleId: 1 })

    mocks.getSystemConfig.mockReset().mockResolvedValue(rawBuffer())
    mocks.decompressAs.mockReset().mockResolvedValue(defaultConfig)
    mocks.clear.mockReset().mockResolvedValue(undefined)
    mocks.put.mockReset().mockResolvedValue(undefined)

    ;({ useDadianStore } = await import('@/stores/dadian'))
  })

  it('初始化时拉取、解压配置并以摘要为 key 写入本地缓存', async () => {
    const store = useDadianStore()
    await store.init()

    expect(mocks.getSystemConfig).toHaveBeenCalledTimes(1)

    const [bytes, options] = mocks.decompressAs.mock.calls[0]
    expect([...bytes]).toEqual([...rawBytes])
    expect(options).toEqual({ name: 'system-config' })

    expect(mocks.clear).toHaveBeenCalledTimes(1)
    expect(mocks.put).toHaveBeenCalledTimes(1)
    expect(mocks.put).toHaveBeenCalledWith({ digest: expectedDigest, json: defaultConfig })

    expect(store.raw).toEqual(defaultConfig)
    expect(store.meta).toEqual({ digest: expectedDigest, version: 'twt702 / twt703' })
  })

  it('重复初始化不会重复发起请求', async () => {
    const store = useDadianStore()

    await store.init()
    await store.init()

    expect(mocks.getSystemConfig).toHaveBeenCalledTimes(1)
    expect(mocks.decompressAs).toHaveBeenCalledTimes(1)
  })

  it('名片列表与索引来自 application.nameCard', async () => {
    const store = useDadianStore()
    await store.init()

    expect(store.nameCardList).toEqual(defaultConfig.application?.nameCard)
    expect(store.nameCardMap.size).toBe(1)
    expect(store.nameCardMap.get('名片A')).toEqual({ label: '名片A', icon: 'a.png' })
  })

  it('tiles / tilesBeta 缺少 base0 时版本号回退为 -NA-', async () => {
    mocks.decompressAs.mockResolvedValue({})

    const store = useDadianStore()
    await store.init()

    expect(store.meta.version).toBe('-NA- / -NA-')
  })

  it('登录角色变化时自动刷新订阅配置', async () => {
    const store = useDadianStore()
    await store.init()

    mocks.getSystemConfig.mockClear()
    mocks.clear.mockClear()

    userSession.info.roleId = 2
    await nextTick()

    await vi.waitFor(() => {
      expect(mocks.getSystemConfig).toHaveBeenCalledTimes(1)
      expect(mocks.clear).toHaveBeenCalledTimes(1)
    })
  })

  it('请求失败时保持空配置，且不写入缓存', async () => {
    mocks.getSystemConfig.mockRejectedValue(new Error('network down'))

    const store = useDadianStore()
    await store.init()

    expect(store.raw).toEqual({})
    expect(store.meta).toEqual({ digest: '', version: '-NA- / -NA-' })
    expect(store.loading).toBe(false)
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('解压失败时保持空配置，且不写入缓存', async () => {
    mocks.decompressAs.mockRejectedValue(new Error('bad archive'))

    const store = useDadianStore()
    await store.init()

    expect(store.raw).toEqual({})
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.put).not.toHaveBeenCalled()
  })
})
