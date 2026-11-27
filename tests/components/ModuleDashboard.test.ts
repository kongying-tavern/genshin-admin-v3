import { flushPromises, mount } from '@vue/test-utils'
import { ElButton, ElCheckbox, ElCheckboxGroup } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ModuleDashboard from '@/components/AppSettings/modules/dashboard/ModuleDashboard.vue'
import { clearTileCache, listStorageCaches } from '@/packages/map/src/utils/tileCache'

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

afterEach(() => vi.unstubAllGlobals())

describe('设置的本地存储', () => {
  it('没有存储用量明细时也能按图源清理瓦片，同时保留其他缓存', async () => {
    const estimate = vi.fn().mockResolvedValue({ usage: 4096 })
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

    vi.stubGlobal('navigator', { storage: { estimate }, userAgent: 'test' })
    vi.stubGlobal('caches', { delete: deleteCache })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.mocked(listStorageCaches)
      .mockResolvedValueOnce({ tileCaches: [first, second], cacheKeys: [fonts] })
      .mockResolvedValueOnce({ tileCaches: [second], cacheKeys: [fonts] })

    const wrapper = mount(ModuleDashboard, {
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

    try {
      await flushPromises()
      await wrapper.get('[aria-label="展开本地存储"]').trigger('click')
      const tile = wrapper.findAll('label').find(entry => entry.text().includes('a.example'))
      expect(tile?.text()).toContain('底图瓦片 · twt40 · https://a.example（OPFS / 旧缓存）')
      await tile!.get('input').setValue(true)
      await wrapper.get('button.el-button').trigger('click')
      await flushPromises()

      expect(clearTileCache).toHaveBeenCalledExactlyOnceWith(first)
      expect(deleteCache).not.toHaveBeenCalled()
      expect(estimate).toHaveBeenCalledTimes(2)
      expect(wrapper.text()).not.toContain('a.example')
      expect(wrapper.text()).toContain('b.example')
      expect(wrapper.text()).toContain(fonts)
    } finally {
      wrapper.unmount()
    }
  })
})
