import type { IconSearchVo, IconTypeVo, IconVo, PageAndTypeSearchVo } from '@/api/alova/globals'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invalidateIconTypes } from '@/hooks/useIconType'
import IconManager from '@/pages/pageIconManager/IconManager.vue'
import { IconTypeManager } from '@/pages/pageTypeManager/definitions/iconType'
import { useIconStore } from '@/stores/icon'

vi.mock('@/stores', () => ({ useUserStore: () => ({}) }))
vi.mock('@/stores/access', () => ({ useAccessStore: () => ({ get: () => true }) }))
vi.mock('@/stores/hooks', () => ({
  useIconTextureRender: () => ({ refresh: vi.fn() }),
  useMarkerTextureRender: () => ({}),
  useManager: () => ({}),
}))
vi.mock('@/stores/utils', () => ({ bulkWrite: vi.fn(), getCostTime: vi.fn() }))
vi.mock('@/hooks/useGlobalDialog', () => ({ useGlobalDialog: () => ({ DialogService: {} }) }))
vi.mock('@/pages/pageIconManager/components/IconCreator.vue', () => ({ default: {} }))
vi.mock('@/pages/pageIconManager/components/IconPreviewer.vue', () => ({ default: {} }))
vi.mock('@/pages/pageTypeManager/components', () => ({
  TypeCreator: {},
  TypeEditor: {},
  TypeDeleteConfirm: {},
}))

const api = {
  icon: { listIcon: vi.fn(), updateIcon: vi.fn() },
  icon_type: { listIconType: vi.fn(), updateIconType: vi.fn(), deleteIconType: vi.fn() },
}

const mountManager = (icons: Map<number, IconVo>) => {
  const pinia = createPinia()
  const store = useIconStore(pinia)
  store.updateLocal({ updateMap: icons })
  const wrapper = mount(IconManager, {
    global: {
      plugins: [pinia, ElementPlus],
      stubs: {
        IconPreviewer: true,
        AppVirtualTable: {
          props: ['data'],
          template: '<div><slot v-for="item in data" :key="item.id" :item="item" /></div>',
        },
      },
    },
  })
  return { wrapper, store }
}

const createTransfer = () => {
  const data = new Map<string, string>()
  return {
    get types() {
      return [...data.keys()]
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    effectAllowed: 'none',
    dropEffect: 'none',
  }
}

describe('图标管理分类', () => {
  let icons: Map<number, IconVo>
  let types: IconTypeVo[]
  let page: ReturnType<typeof mountManager>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('Apis', api)
    invalidateIconTypes()

    icons = new Map([
      [1, { id: 1, version: 1, tag: '红色矿石', typeIdList: [10, 30] }],
      [2, { id: 2, version: 1, tag: '红色花朵', typeIdList: [20] }],
      [3, { id: 3, version: 1, tag: '蓝色矿石' }],
    ])
    types = [
      { id: 10, parentId: -1, isFinal: false, name: '矿石' },
      { id: 20, parentId: -1, isFinal: true, name: '植物' },
      { id: 30, parentId: 10, isFinal: true, name: '稀有矿石' },
      { id: 40, parentId: 10, isFinal: true, name: '常见矿石' },
    ]

    api.icon_type.listIconType.mockImplementation(
      async ({ data }: { data: PageAndTypeSearchVo }) => {
        const records = types.filter(type => type.parentId === data.typeIdList?.[0])
        const start = (data.current ?? 1) - 1
        return { data: { record: records.slice(start, start + 1), total: records.length, size: 1 } }
      },
    )
    api.icon_type.updateIconType.mockImplementation(async ({ data }: { data: IconTypeVo }) => {
      types = types.map(type => (type.id === data.id ? data : type))
      return { data: true }
    })
    api.icon_type.deleteIconType.mockImplementation(
      async ({ pathParams }: { pathParams: { typeId: number } }) => {
        types = types.filter(type => type.id !== pathParams.typeId)
        for (const [id, icon] of icons) {
          icons.set(id, {
            ...icon,
            typeIdList: icon.typeIdList?.filter(id => id !== pathParams.typeId),
          })
        }
        return { data: true }
      },
    )

    api.icon.listIcon.mockImplementation(async ({ data }: { data: IconSearchVo }) => ({
      data: { record: [...icons.values()].filter(icon => data.iconIdList?.includes(icon.id!)) },
    }))
    api.icon.updateIcon.mockImplementation(async ({ data }: { data: IconVo }) => {
      const icon = icons.get(data.id!)
      if (icon?.version !== data.version) return { data: false, message: '版本过期' }
      icons.set(data.id!, { ...icon, ...data, version: (data.version ?? 0) + 1 })
      return { data: true }
    })

    page = mountManager(icons)
  })

  afterEach(() => {
    page.wrapper.unmount()
    vi.unstubAllGlobals()
  })

  const getCategory = (wrapper: typeof page.wrapper, name: string) =>
    wrapper.get<HTMLButtonElement>(`.category-pick[title="${name}"]`)

  const dragToPlant = async (wrapper: typeof page.wrapper) => {
    const card = wrapper.get('.grid-item[title="红色矿石"]')
    const target = wrapper.get('[data-key="20"] .category-row')
    const dataTransfer = createTransfer()
    await card.trigger('dragstart', { dataTransfer })
    await target.trigger('dragover', { dataTransfer })
    expect(target.classes()).toContain('is-drop-target')
    expect(dataTransfer.dropEffect).toBe('copy')
    await target.trigger('drop', { dataTransfer })
    await flushPromises()
  }

  it('默认选中全部分类，搜索和分类筛选同时生效', async () => {
    const { wrapper } = page
    await flushPromises()

    expect(wrapper.get('.category-all').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.grid-item')).toHaveLength(3)
    expect(getCategory(wrapper, '植物').text()).toBe('植物1')
    expect(api.icon_type.listIconType).toHaveBeenCalledTimes(2)

    await getCategory(wrapper, '矿石').trigger('click')
    await wrapper.get('input').setValue('红色')
    expect(wrapper.findAll('.grid-item').map(item => item.text())).toEqual(['红色矿石'])

    await wrapper.get('.category-all').trigger('click')
    expect(wrapper.findAll('.grid-item')).toHaveLength(2)
  })

  it('拖放失败后可以重试，追加分类时保留最新归属，重复投放不写入', async () => {
    const { wrapper, store } = page
    await flushPromises()
    icons.set(1, { id: 1, version: 3, tag: '红色矿石', typeIdList: [10, 30, 40] })

    api.icon.updateIcon.mockResolvedValueOnce({ data: false, message: '版本过期' })
    await dragToPlant(wrapper)
    expect(getCategory(wrapper, '植物').text()).toBe('植物1')
    expect(document.querySelector('.el-message--error')?.textContent).toBe(
      '添加到分类失败：版本过期',
    )

    await dragToPlant(wrapper)
    expect(api.icon.updateIcon).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 1, version: 3, typeIdList: [10, 30, 40, 20] }),
    })
    expect(store.idMap.get(1)?.typeIdList).toEqual([10, 30, 40, 20])
    expect(getCategory(wrapper, '植物').text()).toBe('植物2')

    await dragToPlant(wrapper)
    expect(api.icon.updateIcon).toHaveBeenCalledTimes(2)
  })

  it('写入成功而列表在新版本返回空分类时保留已保存分类，并提示成功', async () => {
    const { wrapper, store } = page
    const original = { ...icons.get(1), version: 2 }
    const incomplete = { ...original, version: 3, typeIdList: [] }
    icons.set(1, original)
    api.icon.listIcon
      .mockResolvedValueOnce({ data: { record: [original] } })
      .mockResolvedValueOnce({ data: { record: [incomplete] } })

    await flushPromises()
    await dragToPlant(wrapper)

    expect(document.querySelector('.el-message--warning')).toBeNull()
    expect(document.querySelector('.el-message--success')?.textContent).toBe('已添加到「植物」')
    expect(getCategory(wrapper, '植物').text()).toBe('植物2')
    expect(store.idMap.get(1)).toMatchObject({ version: 3, typeIdList: [10, 30, 20] })

    api.icon.listIcon.mockResolvedValueOnce({ data: { record: [incomplete] } })
    await store.addIconToCategory(1, 40)
    expect(api.icon.updateIcon).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ version: 3, typeIdList: [10, 30, 20, 40] }),
    })
  })

  it('回读到更新版本时保留服务端分类', async () => {
    const { wrapper, store } = page
    api.icon.updateIcon.mockImplementationOnce(async () => {
      icons.set(1, { ...icons.get(1), version: 3, typeIdList: [10, 40] })
      return { data: true }
    })

    await flushPromises()
    await dragToPlant(wrapper)

    expect(store.idMap.get(1)).toMatchObject({ version: 3, typeIdList: [10, 40] })
    expect(document.querySelector('.el-message--warning')).toBeNull()
  })

  it('类型更新后保留展开和选择，所选分类被删除时回到全部分类', async () => {
    const { wrapper, store } = page
    await flushPromises()

    await wrapper
      .get('[data-key="10"] > .el-tree-node__content .el-tree-node__expand-icon')
      .trigger('click')
    await flushPromises()
    await getCategory(wrapper, '稀有矿石').trigger('click')

    const typeManager = new IconTypeManager()
    await typeManager.update({ ...types[2], name: '矿石样本' })
    await flushPromises()
    expect(getCategory(wrapper, '矿石样本').attributes('aria-pressed')).toBe('true')

    api.icon_type.deleteIconType.mockResolvedValueOnce({ data: false, message: '分类删除失败' })
    await expect(typeManager.delete(types[2])).rejects.toThrow('分类删除失败')
    expect(store.idMap.get(1)?.typeIdList).toEqual([10, 30])

    await typeManager.delete(types[2])
    await flushPromises()
    expect(wrapper.get('.category-all').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.category-pick[title="矿石样本"]').exists()).toBe(false)
    expect(store.idMap.get(1)?.typeIdList).toEqual([10])
  })
})
