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

const accessSession = vi.hoisted(() => ({
  state: { hasBeta: true },
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
    transaction: (_mode: string, _table: unknown, callback: () => Promise<void>) => callback(),
    systemConfig: {
      clear: mocks.clear,
      put: mocks.put,
    },
  },
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => userSession,
}))

vi.mock('@/stores/access', () => ({
  useAccessStore: () => accessSession.state,
}))

vi.mock('@/utils', () => ({
  Zip: { decompressAs: mocks.decompressAs },
  messageFrom: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
}))

/** 归档原始字节（内容无关紧要，摘要按原样计算） */
const rawBytes = new Uint8Array([0x42, 0x5a, 0x68, 0x39, 0x31, 0x41, 0x59, 0x26])

const rawBuffer = () => rawBytes.slice().buffer

const defaultConfig: DTO.DadianJSON = {
  tiles: { '提瓦特-base0': { code: 'twt702' } },
  tilesBeta: { '提瓦特-base0': { code: 'twt703' } },
  application: {
    nameCard: [{ label: '名片A', icon: 'a.png' }, { icon: 'no-label.png' }],
  },
}

/** 与 store 内实现一致的摘要算法 */
const expectedDigest = createHash('sha256').update(rawBytes).digest('hex')

describe('系统订阅配置 store', () => {
  let useDadianStore: (typeof import('@/stores/dadian'))['useDadianStore']

  beforeEach(async () => {
    setActivePinia(createPinia())
    userSession.info = reactive({ roleId: 1 })
    accessSession.state = reactive({ hasBeta: true })

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

  it('区分已下发和已加载的字体，并忽略已替换资源的迟到响应', async () => {
    const fonts = new Set<{ family: string; source: string }>()
    const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
    const failed = Promise.withResolvers<void>()
    const late = Promise.withResolvers<void>()
    const load = vi
      .fn()
      .mockReturnValueOnce(failed.promise)
      .mockReturnValueOnce(late.promise)
      .mockResolvedValue(undefined)
    vi.stubGlobal(
      'FontFace',
      class {
        constructor(
          readonly family: string,
          readonly source: string,
        ) {}
        load = load
      },
    )

    const family = '示例字体 Sans'
    const configWithFont = (url: string): DTO.DadianJSON => ({
      editor: { fontResources: { [family]: { url, type: 'woff2' } } },
    })
    const oldUrl = 'https://example.test/old.woff2'
    const newUrl = 'https://example.test/new.woff2'
    const store = useDadianStore()
    try {
      mocks.decompressAs.mockResolvedValue(configWithFont(oldUrl))
      await store.init()
      expect(store.fontResources[family]?.url).toBe(oldUrl)
      expect(store.loadedFontFamilies.has(family)).toBe(false)

      failed.reject(new Error('字体载入失败'))
      await nextTick()
      expect(store.loadedFontFamilies.has(family)).toBe(false)

      mocks.decompressAs.mockResolvedValue(configWithFont(oldUrl))
      await store.update()
      expect(load).toHaveBeenCalledTimes(2)

      mocks.decompressAs.mockResolvedValue(configWithFont(newUrl))
      await store.update()
      late.resolve()
      await nextTick()
      expect([...fonts]).toEqual([expect.objectContaining({ family, source: `url("${newUrl}")` })])
      const loadedFamily = store.loadedFontFamilies.get(family)
      expect(loadedFamily).toContain(`"${family}"`)

      mocks.decompressAs.mockResolvedValue(configWithFont(oldUrl))
      await store.update()
      expect([...fonts]).toEqual([expect.objectContaining({ source: `url("${oldUrl}")` })])
      expect(store.loadedFontFamilies.get(family)).not.toBe(loadedFamily)

      mocks.decompressAs.mockResolvedValue({})
      await store.update()
      expect(store.fontResources).toEqual({})
      expect(store.loadedFontFamilies.has(family)).toBe(false)
      expect(fonts.size).toBe(0)
    } finally {
      store.$dispose()
      vi.unstubAllGlobals()
      if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
      else Reflect.deleteProperty(document, 'fonts')
    }
  })

  it('tiles / tilesBeta 缺少 base0 时版本号回退为 -NA-', async () => {
    mocks.decompressAs.mockResolvedValue({})

    const store = useDadianStore()
    await store.init()

    expect(store.meta.version).toBe('-NA- / -NA-')
  })

  it('权限降低时立即隐藏 Beta 版本', async () => {
    const store = useDadianStore()
    await store.init()

    accessSession.state.hasBeta = false

    expect(store.meta).toEqual({ digest: expectedDigest, version: 'twt702' })
    expect(store.raw).toEqual(defaultConfig)
  })

  it('加载本地配置及恢复订阅时，原文、签名和版本一起更新', async () => {
    const localConfig: DTO.DadianJSON = {
      tiles: { '提瓦特-base0': { code: 'local' } },
      editor: { quickInputSnippets: ['样例'] },
    }
    const text = JSON.stringify(localConfig)
    const localBytes = new TextEncoder().encode(text)
    const file = {
      type: 'application/json',
      arrayBuffer: async () => localBytes.buffer,
      text: async () => text,
    }
    const getFile = vi.fn().mockResolvedValue(file)
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([{ getFile }]))
    mocks.validateDadianJSON.mockReturnValue({ valid: true })

    try {
      const store = useDadianStore()
      await store.init()

      const pending = Promise.withResolvers<ArrayBuffer>()
      mocks.getSystemConfig.mockReturnValueOnce(pending.promise)
      const staleUpdate = store.update()
      expect(store.loading).toBe(true)

      await store.loadDadianJSON()

      expect(store.raw).toEqual(localConfig)
      expect(store.meta).toEqual({
        digest: createHash('sha256').update(localBytes).digest('hex'),
        version: 'local / -NA-',
      })
      expect(store.loading).toBe(false)

      pending.resolve(rawBuffer())
      await staleUpdate
      expect(store.raw).toEqual(localConfig)
      expect(mocks.put).toHaveBeenCalledTimes(1)

      const pendingFile = Promise.withResolvers<typeof file>()
      getFile.mockReturnValueOnce(pendingFile.promise)
      const staleLocalLoad = store.loadDadianJSON()
      await vi.waitFor(() => expect(getFile).toHaveBeenCalledTimes(2))

      await store.update()
      pendingFile.resolve(file)
      await staleLocalLoad

      expect(store.raw).toEqual(defaultConfig)
      expect(store.meta).toEqual({ digest: expectedDigest, version: 'twt702 / twt703' })
    } finally {
      vi.unstubAllGlobals()
    }
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
