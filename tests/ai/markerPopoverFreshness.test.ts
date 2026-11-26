import type { MarkerVo } from '@/api/alova/globals'
import type { GSMarkerInfo } from '@/packages/map'
import { mount } from '@vue/test-utils'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref, shallowRef } from 'vue'
import { getCapability, inspectSurface } from '@/ai/bindings'
import MarkerTable from '@/components/AppSiderMenu/components/MarkerTable/MarkerTable.vue'
import MapMarkerPopover from '@/components/MapMarkerPopover/MapMarkerPopover.vue'
import { useMarkerControl } from '@/hooks/useMarkerControl'
import { useInteractionInfo } from '@/stores/mapState/hooks/useInteractionInfo'

const sync = reactive({
  scope: 'account',
  online: true,
  projection: { pending: { marker: new Set() } },
})
const local = reactive(new Map<number, GSMarkerInfo>())
const preferences = reactive({ verifyMarkersOnline: true })
const archivePreferences = reactive({ 'map.setting.hideMarkerPopover': false })
const canEdit = ref(false)
const mapState = reactive({
  interaction: useInteractionInfo(),
  subscribeMission: () => ({ isProcessing: ref(false) }),
  setTempMarkers: vi.fn(),
  currentMarkerIdMap: local,
  get currentLayerMarkers() {
    return [...local.values()]
  },
})
const { listMarkerById, openMarkerEditorDialog } = vi.hoisted(() => ({
  listMarkerById: vi.fn(),
  openMarkerEditorDialog: vi.fn(),
}))
const verifyMarkers =
  vi.fn<(ids: number[], signal: AbortSignal) => Promise<Map<number, MarkerVo>>>()
const deletedIds = reactive(new Set<number>())

vi.mock('@/api/alova', () => ({ default: { marker: { listMarkerById } } }))
vi.mock('@/stores/mapEntitySync', () => ({ useMapEntitySync: () => sync }))
vi.mock('@/stores/utils', () => ({ createRenderMarkers: () => [] }))
vi.mock('@/packages/map', () => ({
  EaseoutInterpolator: class {},
  GSMarkerLayer: { layerName: 'marker' },
}))
vi.mock('@/stores', () => ({
  useAccessStore: () => ({
    get: (permission: string) => permission === 'MARKER_EDIT' && canEdit.value,
    checkHiddenFlag: () => true,
  }),
  useArchiveStore: () => ({ preference: archivePreferences }),
  useAreaStore: () => ({}),
  useItemStore: () => ({}),
  useSocketStore: () => ({ ipc: { on: vi.fn() } }),
  usePreferenceStore: () => preferences,
  useMapStateStore: () => mapState,
  useIconStore: () => reactive({ iconTextureUrl: ref(''), iconCoordMap: shallowRef(new Map()) }),
  useMarkerStore: () => ({
    getVisibleMarker: (id: number) => local.get(id),
    verifyMarkers,
    deletedIds,
  }),
}))
vi.mock('@/hooks', async () => ({
  ...(await import('@/hooks/useMarkerControl')),
  ...(await import('@/hooks/useState')),
  useGlobalDialog: () => ({}),
}))
vi.mock('@/components', () => ({
  AppVirtualTable: {
    props: ['data'],
    template: '<div><slot v-for="item in data" :key="item.id" :item="item" /></div>',
  },
  AppBilibiliVideoPlayer: {},
  AppIconTagRenderer: { template: '<div />' },
  GSButton: { template: '<button><slot /></button>' },
}))
vi.mock('@/components/GenshinUI/GSIcon', () => ({ CloseFilled: { template: '<span />' } }))
vi.mock('@/components/MarkerModifyer/actions', () => ({ openMarkerEditorDialog }))
vi.mock('@/components/MapAffix', () => ({
  MapAffix: { template: '<div><slot :zoom="0" /></div>' },
}))
vi.mock('@/components/MapMarkerPopover/components', () => ({
  MarkerPanel: {
    template:
      '<section><slot name="header" /><slot name="content" /><slot name="footer" /></section>',
  },
}))
vi.mock('@/components/MapMarkerPopover/hooks', () => ({
  useMarkerFinished: () => ({}),
  useMarkerMove: () => ({ isMoving: ref(false) }),
  useMarkerExtra: () => ({}),
  useMarkerDelete: () => ({}),
}))

const makeMarker = (id: number, markerTitle: string): GSMarkerInfo =>
  ({
    id,
    markerTitle,
    render: { position: [0, 0], mainIconId: 1, area: { code: 'world:mondstadt' } },
  }) as GSMarkerInfo

describe('点位弹窗句柄与加载状态', () => {
  const controlScope = effectScope()
  const { blur } = controlScope.run(useMarkerControl)!
  let wrapper: ReturnType<typeof mount>
  let table: ReturnType<typeof mount> | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    blur()
    sync.scope = 'account'
    sync.online = true
    preferences.verifyMarkersOnline = true
    archivePreferences['map.setting.hideMarkerPopover'] = false
    mapState.interaction.setIsPopoverOnHover(false)
    canEdit.value = false
    local.clear()
    deletedIds.clear()
    verifyMarkers.mockReset()
    listMarkerById.mockReset()
    openMarkerEditorDialog.mockReset()
    wrapper = mount(MapMarkerPopover, {
      attachTo: document.body,
      global: {
        stubs: {
          transition: false,
          'el-icon': true,
          'el-image': true,
          'el-skeleton': true,
          'el-skeleton-item': true,
        },
      },
    })
  })

  afterEach(() => {
    table?.unmount()
    table = undefined
    wrapper?.unmount()
    vi.useRealTimers()
  })

  afterAll(() => controlScope.stop())

  it('列表立即显示本地点位，点击后只核对选中项', async () => {
    const first = makeMarker(1, '待核对点位')
    const second = makeMarker(2, '其他点位')
    local.set(1, first).set(2, second)
    const read = Promise.withResolvers<Map<number, MarkerVo>>()
    verifyMarkers.mockReturnValueOnce(read.promise)
    table = mount(MarkerTable)

    expect(table.text()).toContain(first.markerTitle)
    expect(table.text()).toContain(second.markerTitle)
    const row = table.findAll('.marker-card')[1]
    await row.trigger('pointerenter')
    await vi.advanceTimersByTimeAsync(200)
    expect(verifyMarkers).not.toHaveBeenCalled()

    await row.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(verifyMarkers).toHaveBeenCalledExactlyOnceWith([1], expect.any(AbortSignal))
    expect(table.text()).toContain(first.markerTitle)
    expect(table.text()).toContain(second.markerTitle)

    const confirmed = { ...first, markerTitle: '已核对点位' }
    local.set(1, confirmed)
    read.resolve(new Map([[1, confirmed]]))
    await vi.advanceTimersByTimeAsync(0)
    expect(table.text()).toContain(confirmed.markerTitle)
    expect(wrapper.text()).toContain(confirmed.markerTitle)
  })

  it('隐藏弹窗时再次点击同一点位会重新核对，确认删除后列表移除该点位', async () => {
    archivePreferences['map.setting.hideMarkerPopover'] = true
    const first = makeMarker(1, '之后被删除的点位')
    const second = makeMarker(2, '保留点位')
    local.set(1, first).set(2, second)
    verifyMarkers.mockResolvedValueOnce(new Map([[1, first]])).mockImplementationOnce(async () => {
      deletedIds.add(1)
      local.delete(1)
      return new Map()
    })
    table = mount(MarkerTable)

    const row = table.findAll('.marker-card')[1]
    await row.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(verifyMarkers).toHaveBeenCalledExactlyOnceWith([1], expect.any(AbortSignal))
    expect(wrapper.find('section').exists()).toBe(false)

    await row.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(verifyMarkers).toHaveBeenNthCalledWith(2, [1], expect.any(AbortSignal))
    expect(table.text()).not.toContain(first.markerTitle)
    expect(table.text()).toContain(second.markerTitle)
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('关闭时离线可直接显示缓存，切换设置后立即应用当前弹窗', async () => {
    preferences.verifyMarkersOnline = false
    sync.online = false
    const cached = makeMarker(1, '本地标题')
    local.set(1, cached)
    const read = Promise.withResolvers<Map<number, MarkerVo>>()
    verifyMarkers.mockReturnValueOnce(read.promise)

    getCapability('markerPopover')!.open!({ markerId: 1 })
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.text()).toContain(cached.markerTitle)
    expect(inspectSurface('markerPopover')?.state).toMatchObject({
      open: true,
      markerId: 1,
      title: cached.markerTitle,
      loading: false,
    })
    expect(verifyMarkers).not.toHaveBeenCalled()
    expect(listMarkerById).not.toHaveBeenCalled()

    sync.online = true
    preferences.verifyMarkersOnline = true
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.find('el-skeleton-stub').exists()).toBe(true)
    expect(verifyMarkers).toHaveBeenCalledTimes(1)

    preferences.verifyMarkersOnline = false
    await nextTick()
    expect(verifyMarkers.mock.calls[0][1].aborted).toBe(true)
    read.resolve(new Map())
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.text()).toContain(cached.markerTitle)
    expect(wrapper.find('el-skeleton-stub').exists()).toBe(false)
    expect(verifyMarkers).toHaveBeenCalledTimes(1)
  })

  it('关闭浏览核对时点击编辑仍先读取服务端版本', async () => {
    preferences.verifyMarkersOnline = false
    canEdit.value = true
    const cached = { ...makeMarker(1, '本地标题'), version: 1 }
    const server = { id: 1, markerTitle: '服务端标题', version: 2 }
    local.set(1, cached)
    listMarkerById.mockResolvedValueOnce({ data: [server] })

    getCapability('markerPopover')!.open!({ markerId: 1 })
    await nextTick()
    expect(listMarkerById).not.toHaveBeenCalled()
    const button = wrapper.findAll('button').find(button => button.text() === '编辑')!
    await button.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(listMarkerById).toHaveBeenCalledWith(
      expect.objectContaining({ data: { markerIdList: [1] } }),
    )
    expect(openMarkerEditorDialog).toHaveBeenCalledWith(server)
    expect(verifyMarkers).not.toHaveBeenCalled()
  })

  it('打开时显示骨架屏，切换点位时只公开当前已核对的标题和内容', async () => {
    const first = makeMarker(1, '缓存标题 A')
    const second = makeMarker(2, '缓存标题 B')
    local.set(1, first).set(2, second)
    const firstRead = Promise.withResolvers<Map<number, MarkerVo>>()
    const secondRead = Promise.withResolvers<Map<number, MarkerVo>>()
    verifyMarkers.mockReturnValueOnce(firstRead.promise).mockReturnValueOnce(secondRead.promise)

    getCapability('markerPopover')!.open!({ markerId: 1 })
    await nextTick()
    expect(wrapper.find('el-skeleton-stub').exists()).toBe(true)
    expect(wrapper.text()).not.toContain(first.markerTitle)
    expect(inspectSurface('markerPopover')?.state).toMatchObject({
      open: true,
      markerId: 1,
      loading: true,
      title: undefined,
    })
    await vi.advanceTimersByTimeAsync(0)

    getCapability('markerPopover')!.open!({ markerId: 2 })
    await nextTick()
    expect(verifyMarkers.mock.calls[0][1].aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    firstRead.resolve(new Map([[1, makeMarker(1, '迟到标题 A')]]))
    const confirmed = { ...second, markerTitle: '已核对标题 B', content: '已核对正文' }
    local.set(2, confirmed)
    secondRead.resolve(new Map([[2, confirmed]]))
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('el-skeleton-stub').exists()).toBe(false)
    expect(wrapper.get('textarea').element.value).toBe('已核对正文')
    expect(wrapper.text()).toContain(confirmed.markerTitle)
    expect(wrapper.text()).not.toContain('迟到标题 A')
    expect(inspectSurface('markerPopover')?.state).toMatchObject({
      open: true,
      markerId: 2,
      loading: false,
      title: confirmed.markerTitle,
    })
  })

  it('关闭时保留标题和正文，淡出结束后移除弹窗', async () => {
    preferences.verifyMarkersOnline = false
    const marker = { ...makeMarker(1, '点位标题'), content: '点位正文' }
    local.set(1, marker)
    getCapability('markerPopover')!.open!({ markerId: 1 })
    await nextTick()

    const panel = wrapper.get('section')
    const affix = panel.element.parentElement!
    await panel.get('button[aria-label="关闭点位详情"]').trigger('click')

    expect(inspectSurface('markerPopover')?.state).toMatchObject({
      open: false,
      markerId: undefined,
      title: undefined,
      loading: false,
    })
    expect(panel.element.isConnected).toBe(true)
    expect(panel.text()).toContain(marker.markerTitle)
    expect(panel.get('textarea').element.value).toBe(marker.content)
    expect(affix.hasAttribute('inert')).toBe(true)

    await vi.advanceTimersByTimeAsync(200)
    expect(affix.isConnected).toBe(false)
  })

  it('核对中关闭会中止请求，淡出时可以打开另一个点位', async () => {
    const first = makeMarker(1, '旧点位')
    const second = { ...makeMarker(2, '新点位'), content: '新点位正文' }
    local.set(1, first).set(2, second)
    const read = Promise.withResolvers<Map<number, MarkerVo>>()
    verifyMarkers.mockReturnValueOnce(read.promise).mockResolvedValueOnce(new Map([[2, second]]))
    const surface = getCapability('markerPopover')!
    surface.open!({ markerId: 1 })
    await nextTick()
    await vi.advanceTimersByTimeAsync(0)

    const leavingPanel = wrapper.get('section').element
    surface.close!()
    await nextTick()

    expect(verifyMarkers.mock.calls[0][1].aborted).toBe(true)
    expect(leavingPanel.isConnected).toBe(true)
    expect(leavingPanel.querySelector('el-skeleton-stub')).not.toBeNull()

    surface.open!({ markerId: 2 })
    await nextTick()

    expect(leavingPanel.isConnected).toBe(false)
    expect(wrapper.get('section').element.closest('[inert]')).toBeNull()
    expect(wrapper.find('el-skeleton-stub').exists()).toBe(true)
    read.resolve(new Map([[1, first]]))
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.text()).toContain(second.markerTitle)
    expect(wrapper.get('textarea').element.value).toBe(second.content)
  })

  it('查询失败时只展示错误态并允许重试', async () => {
    const cached = makeMarker(1, '过期标题')
    local.set(1, cached)
    const confirmed = { ...cached, markerTitle: '当前标题' }
    verifyMarkers.mockRejectedValueOnce(new Error('网络暂不可用'))
    verifyMarkers.mockImplementationOnce(async () => {
      local.set(1, confirmed)
      return new Map([[1, confirmed]])
    })
    getCapability('markerPopover')!.open!({ markerId: 1 })
    await nextTick()
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.text()).toContain('暂时无法核对点位详情')
    expect(wrapper.text()).not.toContain(cached.markerTitle)
    expect(wrapper.find('textarea').exists()).toBe(false)

    const retry = wrapper.findAll('button').find(button => button.text() === '重试')!
    await retry.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.text()).toContain(confirmed.markerTitle)
  })
})
