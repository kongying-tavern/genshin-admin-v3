import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ArchiveViewer from '@/components/AppUserInfo/ArchiveViewer.vue'

const store = vi.hoisted(() => ({
  archiveSlots: {
    1: { name: '主存档', archiveList: [] },
    2: {
      name: '副存档',
      archiveList: [{ historyIndex: 1, timestamp: 30, body: { Data_KYJG: new Set([3]) } }],
    },
  },
  loadArchiveSlot: vi.fn(),
  loadHistoryArchive: vi.fn(),
}))
vi.mock('@/stores', () => ({ SETTINGS_SLOT: 1, useArchiveStore: () => store }))
vi.mock('@/hooks', async () => ({ useFetchHook: (await import('@/hooks/useFetch')).useFetchHook }))
vi.mock('@/utils', () => ({ messageFrom: String }))
vi.mock('@/components', () => ({
  GSCard: { template: '<section><slot name="title" /><slot /></section>' },
  GSButton: { template: '<button><slot /></button>' },
  GSDivider: { template: '<hr>' },
  GSInput: { template: '<input>' },
}))

describe('云存档查看器', () => {
  it('普通槽位可选历史，切到 1 号后仅能读取当前进度', async () => {
    const wrapper = mount(ArchiveViewer, {
      props: { slotIndex: 2 },
      global: {
        stubs: {
          ElDialog: { template: '<div><slot /></div>' },
          ElTooltip: { template: '<span><slot /></span>' },
          ElIcon: true,
          ElTag: true,
          QuestionFilled: true,
        },
      },
    })
    expect(wrapper.find('.hold-and-delete').exists()).toBe(true)
    await wrapper.get('.history-item').trigger('click')
    expect(wrapper.text()).toContain('读取该历史')
    await wrapper.setProps({ slotIndex: 1 })
    expect(wrapper.text()).toContain('账号设置')
    expect(wrapper.find('.history-item').exists()).toBe(false)
    expect(wrapper.find('.hold-and-delete').exists()).toBe(false)
    const read = wrapper.findAll('button').find(button => button.text() === '读取存档')!
    await read.trigger('click')
    await flushPromises()
    expect(store.loadArchiveSlot).toHaveBeenCalledWith(1)
    expect(store.loadHistoryArchive).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
