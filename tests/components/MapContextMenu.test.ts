import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import MapContextMenu from '@/components/MapContextMenu/MapContextMenu.vue'
import { mapContainerHeightKey, mapContainerWidthKey, MapSubject, mapViewStateKey } from '@/shared'

const { openMarkerCreatorDialog, openSettingsDialog } = vi.hoisted(() => ({
  openMarkerCreatorDialog: vi.fn(),
  openSettingsDialog: vi.fn(),
}))

const permission = ref(true)
const user = reactive({ isLogin: true })
const viewState = ref({ target: [50, 60] as DTO.Coordinate2D, zoom: 1 })
const defaultItem = { id: 3, name: '甜甜花' }
const tile = reactive({
  currentTileConfig: { tile: { center: [10, 20] as DTO.Coordinate2D } },
  toMarkerCoordinate: ([x, y]: DTO.Coordinate2D): DTO.Coordinate2D => [x - 10, y - 20],
})
const mapState = reactive({
  mission: false,
  interaction: { clearFocus: vi.fn(), clearHover: vi.fn() },
})

vi.mock('@/components/MarkerModifyer/actions', () => ({ openMarkerCreatorDialog }))
vi.mock('@/components/AppSettings/open', () => ({ openSettingsDialog }))
vi.mock('@/stores', () => ({
  useAccessStore: () => ({ get: () => permission.value }),
  useUserStore: () => user,
  useMapStateStore: () => mapState,
  useTileStore: () => tile,
  useItemStore: () => ({ itemIdMap: new Map([[3, defaultItem]]) }),
  usePreferenceStore: () => ({ defaultMarkingItemId: 3 }),
}))

const mountMenu = () => {
  const wrapper = mount(MapContextMenu, {
    attachTo: document.body,
    props: {
      placing: false,
      modalOpen: false,
      mapReady: true,
      getMapCenter: () => viewState.value.target,
      'onUpdate:placing': (placing: boolean) => void wrapper.setProps({ placing }),
    },
    global: {
      provide: {
        [mapContainerWidthKey]: ref(800),
        [mapContainerHeightKey]: ref(600),
        [mapViewStateKey]: viewState,
      },
      stubs: { 'el-icon': true },
    },
  })
  return wrapper
}

const rightClick = (coordinate: DTO.Coordinate2D) => {
  type MapClick = Parameters<typeof MapSubject.click.next>[0]
  MapSubject.click.next({
    info: {
      coordinate,
      color: null,
      layer: null,
      index: -1,
      picked: false,
      x: 0,
      y: 0,
      pixelRatio: 1,
    },
    event: { rightButton: true } as MapClick['event'],
  })
}

describe('地图点位创建入口', () => {
  let wrapper: ReturnType<typeof mountMenu>

  beforeEach(() => {
    vi.clearAllMocks()
    permission.value = true
    user.isLogin = true
    viewState.value.target = [50, 60]
    mapState.mission = false
    wrapper = mountMenu()
  })

  afterEach(() => wrapper.unmount())

  it('主动选址后用确认时的地图中心打开表单，并沿用默认物品', async () => {
    await wrapper.get('.placement-trigger').trigger('click')
    expect(wrapper.get('[aria-label="点位选址"]').text()).toContain('中心十字')
    expect(wrapper.find('.reticle-center').exists()).toBe(true)
    expect(mapState.interaction.clearFocus).toHaveBeenCalledOnce()
    expect(mapState.interaction.clearHover).toHaveBeenCalledOnce()
    expect(openMarkerCreatorDialog).not.toHaveBeenCalled()

    viewState.value.target = [70, 90]
    await wrapper.get('.placement-actions .primary').trigger('click')
    expect(openMarkerCreatorDialog).toHaveBeenCalledWith([60, 70], defaultItem)
    expect(wrapper.find('.placement-reticle').exists()).toBe(false)
  })

  it('支持 Escape 取消，并在地图任务或权限变化时退出选址', async () => {
    await wrapper.get('.placement-trigger').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    await nextTick()
    expect(wrapper.find('.placement-panel').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.placement-trigger').element)

    await wrapper.get('.placement-trigger').trigger('click')
    mapState.mission = true
    await nextTick()
    expect(wrapper.find('.placement-panel').exists()).toBe(false)
    expect(wrapper.get('.placement-trigger').attributes('disabled')).toBeDefined()

    mapState.mission = false
    await nextTick()
    await wrapper.get('.placement-trigger').trigger('click')
    permission.value = false
    await nextTick()
    expect(wrapper.find('.placement-reticle').exists()).toBe(false)
    expect(wrapper.find('.placement-trigger').exists()).toBe(false)
    expect(openMarkerCreatorDialog).not.toHaveBeenCalled()
  })

  it('右键菜单靠近视口边缘时翻转，仍按点击坐标创建点位', async () => {
    rightClick([245, 205])
    await nextTick()

    const reticle = wrapper.get('.placement-reticle').element as HTMLElement
    expect(reticle.style.left).toBe('790px')
    expect(reticle.style.top).toBe('590px')
    const menu = wrapper.get('.context-menu').element as HTMLElement
    expect(menu.style.transformOrigin).toBe('right bottom')

    await wrapper.get('.context-menu .primary').trigger('click')
    expect(openMarkerCreatorDialog).toHaveBeenCalledWith([235, 185], defaultItem)
  })

  it('没有创建权限时右键仍能打开系统设置', async () => {
    permission.value = false
    rightClick([50, 60])
    await nextTick()

    expect(wrapper.find('.placement-trigger').exists()).toBe(false)
    expect(wrapper.find('.context-menu .primary').exists()).toBe(false)
    await wrapper.get('.context-menu button').trigger('click')
    expect(openSettingsDialog).toHaveBeenCalledOnce()
    expect(wrapper.find('.context-menu').exists()).toBe(false)
  })
})
