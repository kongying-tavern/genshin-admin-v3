import { flushPromises, mount } from '@vue/test-utils'
import { ElButton, ElCheckbox, ElCheckboxGroup, ElMessage } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ModuleDashboard from '@/components/AppSettings/modules/dashboard/ModuleDashboard.vue'
import { clearTileCache, listStorageCaches } from '@/packages/map/src/utils/tileCache'
import type { StaticCacheClearRequest } from '@/worker/service/utils/static-cache-clear-protocol'
import { STATIC_CACHE_CLEAR } from '@/worker/service/utils/static-cache-clear-protocol'
import { staticCacheName } from '@/worker/service/utils/static-cache-name'

vi.mock('@/hooks', async () => ({ useFetchHook: (await import('@/hooks/useFetch')).useFetchHook }))
vi.mock('@/stores', () => ({
  useBroadcastStore: () => ({ meta: { id: 'test' }, state: { clients: new Map() } }),
  useUserStore: () => ({}),
}))
vi.mock('@/utils', async () => ({
  formatByteSize: (await import('@/utils/formatByteSize')).formatByteSize,
  messageFrom: String,
}))
vi.mock('@/components/AppSettings/components/ShortcutKey', () => ({}))
vi.mock('@/components/AppSettings/modules/dashboard/components', () => ({
  StorageChart: { template: '<div />' },
}))
vi.mock('@/packages/map/src/utils/tileCache', () => ({
  clearTileCache: vi.fn(),
  listStorageCaches: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

const mountDashboard = () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  return mount(ModuleDashboard, {
    global: {
      components: { ElButton, ElCheckbox, ElCheckboxGroup },
      directives: { loading: () => {} },
      stubs: {
        ElAvatar: true,
        ElDescriptions: true,
        ElIcon: true,
        ElScrollbar: { template: '<div><slot /></div>' },
      },
    },
  })
}

const stubNavigator = (estimate: () => Promise<StorageEstimate>, postMessage = vi.fn()) => {
  vi.stubGlobal('navigator', {
    storage: { estimate },
    userAgent: 'test',
    serviceWorker: {
      getRegistration: vi.fn().mockResolvedValue({
        scope: 'https://example.test/',
        active: { postMessage },
      }),
    },
  })
}

describe('设置的本地存储', () => {
  it('没有存储用量明细时也能按图源清理瓦片，同时保留其他缓存', async () => {
    const estimate = vi.fn().mockResolvedValue({ usage: 4096 })
    const postMessage = vi.fn()
    const deleteCache = vi.fn()
    const fonts = 'n=fonts&v=3&t=font&m=cors'
    const first = {
      sourceKey: 'first',
      code: 'twt40',
      source: 'https://a.example',
      opfs: true,
      legacy: true,
    }
    const second = {
      sourceKey: 'second',
      code: 'twt40',
      source: 'https://b.example',
      opfs: true,
      legacy: false,
    }

    stubNavigator(estimate, postMessage)
    vi.stubGlobal('caches', { delete: deleteCache })
    vi.mocked(listStorageCaches)
      .mockResolvedValueOnce({ tileCaches: [first, second], cacheKeys: [fonts] })
      .mockResolvedValueOnce({ tileCaches: [second], cacheKeys: [fonts] })

    const wrapper = mountDashboard()

    try {
      await flushPromises()
      await wrapper.get('[aria-label="展开本地存储"]').trigger('click')
      const tile = wrapper.findAll('label').find(entry => entry.text().includes('a.example'))
      expect(tile?.text()).toContain('底图瓦片 · twt40 · https://a.example（OPFS / 旧缓存）')
      await tile!.get('input').setValue(true)
      await wrapper.get('button.el-button').trigger('click')
      await flushPromises()

      expect(clearTileCache).toHaveBeenCalledExactlyOnceWith(first)
      expect(postMessage).not.toHaveBeenCalled()
      expect(deleteCache).not.toHaveBeenCalled()
      expect(estimate).toHaveBeenCalledTimes(2)
      expect(wrapper.text()).not.toContain('a.example')
      expect(wrapper.text()).toContain('b.example')
      expect(wrapper.text()).toContain(fonts)
    } finally {
      wrapper.unmount()
    }
  })

  it('只显示同作用域的已知通用缓存，并通过服务线程清理选中项', async () => {
    const icons = staticCacheName('/', 'icons', 'cors')
    const fonts = 'n=fonts&v=3&t=font&m=cors'
    const ignored = [
      'other-app-cache',
      'n=tiles-twt40&v=1&m=cors',
      staticCacheName('/other/', 'icons', 'cors'),
      icons.replace('v=4', 'v=5'),
    ]
    const cacheKeys = new Set([icons, fonts, ...ignored])
    vi.mocked(listStorageCaches).mockImplementation(async () => ({
      tileCaches: [],
      cacheKeys: [...cacheKeys],
    }))
    const postMessage = vi.fn((message: StaticCacheClearRequest, [reply]: MessagePort[]) => {
      cacheKeys.delete(message.name)
      reply.postMessage({ ok: true })
    })
    const deleteCache = vi.fn()
    stubNavigator(vi.fn().mockResolvedValue({}), postMessage)
    vi.stubGlobal('caches', { delete: deleteCache })

    const wrapper = mountDashboard()
    try {
      await flushPromises()
      await wrapper.get('[aria-label="展开本地存储"]').trigger('click')
      const labels = wrapper.findAll('label')
      expect(labels.map(entry => entry.text())).toEqual([icons, fonts])
      for (const label of labels) await label.get('input').setValue(true)
      await wrapper.get('button.el-button').trigger('click')
      await vi.waitFor(() => expect(wrapper.findAll('label')).toHaveLength(0))
      expect(postMessage.mock.calls.map(([message]) => message)).toEqual([
        { type: STATIC_CACHE_CLEAR, name: icons },
        { type: STATIC_CACHE_CLEAR, name: fonts },
      ])
      expect([...cacheKeys]).toEqual(ignored)
      expect(deleteCache).not.toHaveBeenCalled()
      expect(clearTileCache).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('服务线程清理失败时保留选中项，可再次提交', async () => {
    const icons = staticCacheName('/', 'icons', 'cors')
    const notify = vi.spyOn(ElMessage, 'error').mockReturnValue({ close: vi.fn() })
    vi.mocked(listStorageCaches).mockResolvedValue({ tileCaches: [], cacheKeys: [icons] })
    const postMessage = vi
      .fn((_message: StaticCacheClearRequest, [reply]: MessagePort[]) => {
        reply.postMessage({ ok: true })
      })
      .mockImplementationOnce((_message, [reply]) => reply.postMessage({ ok: false }))
    stubNavigator(vi.fn().mockResolvedValue({}), postMessage)

    const wrapper = mountDashboard()
    try {
      await flushPromises()
      await wrapper.get('[aria-label="展开本地存储"]').trigger('click')
      const input = wrapper.get<HTMLInputElement>('label input')
      const clearButton = wrapper.get<HTMLButtonElement>('button.el-button')
      await input.setValue(true)
      await clearButton.trigger('click')
      await vi.waitFor(() => expect(notify).toHaveBeenCalledOnce())
      expect(input.element.checked).toBe(true)
      expect(clearButton.element.disabled).toBe(false)

      await clearButton.trigger('click')
      await vi.waitFor(() => expect(input.element.checked).toBe(false))
      expect(postMessage).toHaveBeenCalledTimes(2)
    } finally {
      wrapper.unmount()
    }
  })
})
