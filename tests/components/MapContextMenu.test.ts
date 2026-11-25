import type { DeckProps, OrthographicView } from 'deck.gl'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import MapContextMenu from '@/components/MapContextMenu/MapContextMenu.vue'
import { mapContainerHeightKey, mapContainerWidthKey, MapSubject, mapViewStateKey } from '@/shared'

const { openMarkerCreatorDialog, openSettingsDialog, createDeck, setDeckProps, finalizeDeck } =
  vi.hoisted(() => ({
    openMarkerCreatorDialog: vi.fn(),
    openSettingsDialog: vi.fn(),
    createDeck: vi.fn<(props: DeckProps<OrthographicView>) => void>(),
    setDeckProps: vi.fn(),
    finalizeDeck: vi.fn(),
  }))

const permission = ref(true)
const preference = reactive({
  defaultMarkingItemId: 3,
  lockPlacementReticle: false,
  showPlacementMinimap: false,
})
const user = reactive({ isLogin: true })
const viewState = ref({ target: [50, 60] as DTO.Coordinate2D, zoom: 1 })
const width = ref(800)
const height = ref(600)
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
vi.mock('@/hooks/useMapLayers', () => ({ useTerrainLayers: () => ref([]) }))
vi.mock('deck.gl', async importOriginal => ({
  ...(await importOriginal<typeof import('deck.gl')>()),
  Deck: class {
    constructor(props: DeckProps<OrthographicView>) {
      createDeck(props)
    }
    setProps = setDeckProps
    finalize = finalizeDeck
  },
}))
vi.mock('@/stores', () => ({
  useAccessStore: () => ({ get: () => permission.value }),
  useUserStore: () => user,
  useMapStateStore: () => mapState,
  useTileStore: () => tile,
  useItemStore: () => ({ itemIdMap: new Map([[3, defaultItem]]) }),
  usePreferenceStore: () => preference,
}))

const getMapCoordinate = ([x, y]: DTO.Coordinate2D): DTO.Coordinate2D => {
  const { target, zoom } = viewState.value
  const scale = 2 ** zoom
  return [target[0] + (x - width.value / 2) / scale, target[1] + (y - height.value / 2) / scale]
}

const mountMenu = () => {
  const wrapper = mount(MapContextMenu, {
    attachTo: document.body,
    props: {
      placing: false,
      modalOpen: false,
      mapReady: true,
      getMapCoordinate,
      'onUpdate:placing': (placing: boolean) => void wrapper.setProps({ placing }),
    },
    global: {
      provide: {
        [mapContainerWidthKey]: width,
        [mapContainerHeightKey]: height,
        [mapViewStateKey]: viewState,
      },
      stubs: { 'el-icon': true },
    },
  })
  return wrapper
}

type MapClick = Parameters<typeof MapSubject.click.next>[0]
const mapEvent = ([x, y]: DTO.Coordinate2D, rightButton = false): MapClick => ({
  info: {
    coordinate: getMapCoordinate([x, y]),
    color: null,
    layer: null,
    index: -1,
    picked: false,
    x,
    y,
    pixelRatio: 1,
  },
  event: { rightButton } as MapClick['event'],
})
const rightClick = (point: DTO.Coordinate2D) => MapSubject.click.next(mapEvent(point, true))

const pointer = (
  element: HTMLElement,
  type: string,
  [clientX, clientY]: DTO.Coordinate2D,
  options: PointerEventInit = {},
) =>
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: 'mouse',
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX,
      clientY,
      ...options,
    }),
  )

const mockPointerCapture = (element: HTMLElement) => {
  const capture = {
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  }
  Object.assign(element, capture)
  return capture
}

describe('地图点位创建入口', () => {
  let wrapper: ReturnType<typeof mountMenu>

  beforeEach(() => {
    vi.clearAllMocks()
    permission.value = true
    preference.lockPlacementReticle = false
    preference.showPlacementMinimap = false
    user.isLogin = true
    viewState.value.zoom = 1
    viewState.value.target = [50, 60]
    width.value = 800
    height.value = 600
    mapState.mission = false
    wrapper = mountMenu()
  })

  afterEach(() => wrapper.unmount())

  it('触屏从地图中心开始选址，可分别拖动罗盘和地图，再用罗盘位置打开表单', async () => {
    await wrapper.get('.placement-trigger').trigger('click')
    expect(wrapper.find('.placement-trigger').exists()).toBe(false)
    const actions = wrapper.get('.context-menu [aria-label="点位选址"]')
    expect(actions.findAll('button').map(button => button.text())).toEqual([
      '添加点位',
      '锁定',
      '退出创建模式',
    ])
    expect(actions.get('.warning').text()).toBe('退出创建模式')
    const lock = actions.get('[role="switch"]')
    expect(lock.attributes('aria-checked')).toBe('false')
    expect(wrapper.find('.reticle-center').exists()).toBe(true)
    expect(createDeck).not.toHaveBeenCalled()
    expect(mapState.interaction.clearFocus).toHaveBeenCalledOnce()
    expect(mapState.interaction.clearHover).toHaveBeenCalledOnce()

    const reticle = wrapper.get<HTMLElement>('.placement-reticle').element
    expect(reticle.style.left).toBe('400px')
    expect(reticle.style.top).toBe('300px')
    const capture = mockPointerCapture(reticle)
    const touch = { pointerType: 'touch' }
    pointer(reticle, 'pointerdown', [410, 300], touch)
    pointer(reticle, 'pointermove', [450, 340], touch)
    pointer(reticle, 'pointerup', [470, 360], touch)
    expect(capture.setPointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(capture.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    await nextTick()
    expect(reticle.style.left).toBe('460px')
    expect(reticle.style.top).toBe('360px')

    MapSubject.dragStart.next(mapEvent([200, 220]))
    viewState.value.target = [70, 90]
    await nextTick()
    expect(reticle.style.left).toBe('460px')
    expect(reticle.style.top).toBe('360px')
    expect(openMarkerCreatorDialog).not.toHaveBeenCalled()

    await wrapper.get('.context-menu .primary').trigger('click')
    expect(openMarkerCreatorDialog).toHaveBeenCalledExactlyOnceWith([90, 100], defaultItem)
    expect(wrapper.find('.placement-reticle').exists()).toBe(false)
    expect(wrapper.find('.placement-trigger').exists()).toBe(true)
  })

  it('小地图跟随罗盘下的地图坐标并固定缩放，旋转三角后仍按同一坐标创建', async () => {
    preference.showPlacementMinimap = true
    await nextTick()
    expect(createDeck).not.toHaveBeenCalled()
    await wrapper.get('.placement-trigger').trigger('click')
    expect(createDeck).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        views: expect.objectContaining({
          id: 'placement-minimap',
          props: expect.objectContaining({ controller: false }),
        }),
        viewState: { target: [50, 60], zoom: 0 },
      }),
    )

    const reticle = wrapper.get<HTMLElement>('.placement-reticle').element
    mockPointerCapture(reticle)
    pointer(reticle, 'pointerdown', [400, 300])
    pointer(reticle, 'pointermove', [440, 280])
    pointer(reticle, 'pointerup', [440, 280])
    await nextTick()
    expect(setDeckProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewState: { target: [70, 50], zoom: 0 } }),
    )

    viewState.value = { target: [70, 90], zoom: 3 }
    await nextTick()
    expect(setDeckProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        viewState: { target: [75, 87.5], zoom: 0 },
      }),
    )
    setDeckProps.mockClear()
    await wrapper.get('input[aria-label="三角朝向"]').setValue('90')
    expect(wrapper.find('svg g[transform="rotate(90)"]').exists()).toBe(true)
    expect(setDeckProps).not.toHaveBeenCalled()
    await wrapper.get('.context-menu .primary').trigger('click')
    expect(openMarkerCreatorDialog).toHaveBeenCalledWith([65, 67.5], defaultItem)
    expect(finalizeDeck).toHaveBeenCalledOnce()
  })

  it('鼠标选址锁定当前罗盘坐标，平移和缩放只移动主图上的罗盘和菜单', async () => {
    preference.showPlacementMinimap = true
    rightClick([430, 370])
    await nextTick()
    const reticle = wrapper.get<HTMLElement>('.placement-reticle').element
    const capture = mockPointerCapture(reticle)
    pointer(reticle, 'pointerdown', [430, 370])
    pointer(reticle, 'pointerup', [450, 350])
    await nextTick()

    const lock = wrapper.get('[role="switch"]')
    expect(lock.attributes('aria-checked')).toBe('false')
    await lock.trigger('click')
    expect(preference.lockPlacementReticle).toBe(true)
    expect(lock.attributes('aria-checked')).toBe('true')
    expect(reticle.classList.contains('locked-reticle')).toBe(true)
    expect(reticle.classList.contains('draggable-reticle')).toBe(false)
    expect(reticle.style.left).toBe('450px')
    expect(reticle.style.top).toBe('350px')

    pointer(reticle, 'pointerdown', [450, 350])
    pointer(reticle, 'pointerup', [470, 370])
    expect(capture.setPointerCapture).toHaveBeenCalledOnce()
    setDeckProps.mockClear()
    const menu = wrapper.get<HTMLElement>('.context-menu').element
    const menuLeft = menu.style.left
    MapSubject.dragStart.next(mapEvent([200, 220]))
    viewState.value = { target: [85, 100], zoom: 2 }
    await nextTick()
    expect(reticle.style.left).toBe('360px')
    expect(reticle.style.top).toBe('240px')
    expect(menu.style.left).not.toBe(menuLeft)
    expect(setDeckProps).not.toHaveBeenCalled()

    await wrapper.get('.context-menu .primary').trigger('click')
    expect(openMarkerCreatorDialog).toHaveBeenCalledExactlyOnceWith([65, 65], defaultItem)
  })

  it('触屏沿用锁定设置，瞄准环移出视口后仍可确认或解锁', async () => {
    preference.lockPlacementReticle = true
    await wrapper.get('.placement-trigger').trigger('click')
    const reticle = wrapper.get<HTMLElement>('.placement-reticle').element
    expect(reticle.classList.contains('locked-reticle')).toBe(true)
    expect(reticle.style.left).toBe('400px')
    expect(reticle.style.top).toBe('300px')

    viewState.value.target = [-500, 70]
    await nextTick()
    expect(reticle.style.left).toBe('1500px')
    expect(reticle.style.top).toBe('280px')
    await wrapper.get('.context-menu .primary').trigger('click')
    expect(openMarkerCreatorDialog).toHaveBeenCalledExactlyOnceWith([40, 40], defaultItem)

    await wrapper.get('.placement-trigger').trigger('click')
    const nextReticle = wrapper.get<HTMLElement>('.placement-reticle').element
    const lock = wrapper.get('[role="switch"]')
    expect(lock.attributes('aria-checked')).toBe('true')
    viewState.value.target = [-250, 82]
    await nextTick()
    expect(nextReticle.style.left).toBe('-100px')
    await lock.trigger('click')
    expect(preference.lockPlacementReticle).toBe(false)
    expect(nextReticle.classList.contains('draggable-reticle')).toBe(true)
    expect(nextReticle.style.left).toBe('0px')
    expect(nextReticle.style.top).toBe('276px')

    viewState.value.target = [-260, 85]
    await nextTick()
    expect(nextReticle.style.left).toBe('0px')
    expect(nextReticle.style.top).toBe('276px')
  })

  it('右键小地图以点击位置为中心，关闭开关或撤权时释放视口', async () => {
    rightClick([430, 370])
    await nextTick()
    expect(createDeck).not.toHaveBeenCalled()
    preference.showPlacementMinimap = true
    await nextTick()
    expect(createDeck.mock.calls[0][0].viewState).toEqual({ target: [65, 95], zoom: 0 })
    await wrapper.get('input[type="range"]').setValue('180')
    preference.showPlacementMinimap = false
    await nextTick()
    expect(finalizeDeck).toHaveBeenCalledOnce()
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.find('.context-menu .primary').exists()).toBe(true)

    preference.showPlacementMinimap = true
    await nextTick()
    expect(wrapper.get('input[type="range"]').element).toHaveProperty('value', '180')
    permission.value = false
    await nextTick()
    expect(finalizeDeck).toHaveBeenCalledTimes(2)
    expect(wrapper.find('canvas').exists()).toBe(false)
  })

  it('支持 Escape 取消，并在地图任务或权限变化时退出选址', async () => {
    await wrapper.get('.placement-trigger').trigger('click')
    expect(wrapper.find('.context-menu').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    await nextTick()
    expect(wrapper.find('.context-menu').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.placement-trigger').element)

    await wrapper.get('.placement-trigger').trigger('click')
    mapState.mission = true
    await nextTick()
    expect(wrapper.find('.context-menu').exists()).toBe(false)
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
    rightClick([790, 590])
    await nextTick()

    const reticle = wrapper.get('.placement-reticle').element as HTMLElement
    expect(reticle.style.left).toBe('790px')
    expect(reticle.style.top).toBe('590px')
    const menu = wrapper.get('.context-menu').element as HTMLElement
    expect(menu.style.transformOrigin).toBe('right bottom')

    await wrapper.get('.context-menu .primary').trigger('click')
    expect(openMarkerCreatorDialog).toHaveBeenCalledWith([235, 185], defaultItem)
  })

  it('右键选址时添加按钮跟随罗盘对齐，拖动地图后仍可确认罗盘位置', async () => {
    rightClick([240, 250])
    await nextTick()
    const reticle = wrapper.get<HTMLElement>('.placement-reticle').element
    const menu = wrapper.get<HTMLElement>('.context-menu').element
    const addButton = wrapper.get('.context-menu .primary')
    // jsdom 不计算布局，提供按钮相对菜单的偏移和高度。
    Object.defineProperties(addButton.element, {
      offsetTop: { value: 9 },
      offsetHeight: { value: 44 },
    })
    expect(reticle.style.left).toBe('240px')
    expect(reticle.style.top).toBe('250px')
    const menuLeft = menu.style.left

    mockPointerCapture(reticle)
    pointer(reticle, 'pointerdown', [242, 250])
    pointer(reticle, 'pointermove', [282, 280])
    pointer(reticle, 'pointerup', [282, 280])
    await nextTick()
    expect(reticle.style.left).toBe('280px')
    expect(reticle.style.top).toBe('280px')
    expect(menu.style.left).not.toBe(menuLeft)
    expect(menu.style.top).toBe('249px')

    MapSubject.dragStart.next(mapEvent([200, 220]))
    viewState.value = { target: [70, 90], zoom: 2 }
    MapSubject.click.next(mapEvent([200, 220]))
    await nextTick()
    expect(reticle.style.left).toBe('280px')
    expect(reticle.style.top).toBe('280px')
    expect(openMarkerCreatorDialog).not.toHaveBeenCalled()

    await addButton.trigger('click')
    expect(openMarkerCreatorDialog).toHaveBeenCalledExactlyOnceWith([30, 65], defaultItem)
    expect(wrapper.find('.context-menu').exists()).toBe(false)
  })

  it('罗盘拖到边缘或收到指针取消时保持选址，随后可从右键菜单退出', async () => {
    rightClick([420, 320])
    await nextTick()
    const reticle = wrapper.get<HTMLElement>('.placement-reticle').element
    const capture = mockPointerCapture(reticle)
    pointer(reticle, 'pointerdown', [420, 320])
    pointer(reticle, 'pointermove', [1500, -100])
    pointer(reticle, 'pointercancel', [0, 0])
    pointer(reticle, 'lostpointercapture', [800, 0])
    pointer(reticle, 'pointermove', [300, 200])
    await nextTick()
    expect(capture.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
    expect(reticle.style.left).toBe('800px')
    expect(reticle.style.top).toBe('0px')

    width.value = 600
    await nextTick()
    expect(reticle.style.left).toBe('600px')
    const exit = wrapper
      .findAll('.context-menu button')
      .find(button => button.text() === '退出创建模式')
    expect(exit).toBeDefined()
    await exit!.trigger('click')
    expect(wrapper.find('.context-menu').exists()).toBe(false)
    expect(wrapper.find('.placement-reticle').exists()).toBe(false)
    expect(openMarkerCreatorDialog).not.toHaveBeenCalled()

    await wrapper.get('.placement-trigger').trigger('click')
    expect(wrapper.get<HTMLElement>('.placement-reticle').element.style.left).toBe('300px')
  })

  it('没有创建权限时右键仍能打开系统设置', async () => {
    permission.value = false
    rightClick([400, 300])
    await nextTick()

    expect(wrapper.find('.placement-trigger').exists()).toBe(false)
    expect(wrapper.find('.context-menu .primary').exists()).toBe(false)
    expect(wrapper.get('.context-menu').text()).not.toContain('编辑地区标签')
    await wrapper.get('.context-menu button').trigger('click')
    expect(openSettingsDialog).toHaveBeenCalledOnce()
    expect(wrapper.find('.context-menu').exists()).toBe(false)
  })

  it('开发工具可用时把右键位置传给标签编辑器', async () => {
    const openAreaTagEditor = vi.fn()
    await wrapper.setProps({ areaTagAction: { label: '编辑地区标签', open: openAreaTagEditor } })
    rightClick([430, 370])
    await nextTick()

    const editButton = wrapper
      .findAll('.context-menu button')
      .find(button => button.text() === '编辑地区标签')
    expect(editButton).toBeDefined()
    await editButton!.trigger('click')
    expect(openAreaTagEditor).toHaveBeenCalledWith([65, 95])
    expect(wrapper.find('.context-menu').exists()).toBe(false)

    await wrapper.setProps({
      editingAreaTags: true,
      areaTagAction: { label: '在此新增标签', open: openAreaTagEditor },
    })
    rightClick([470, 380])
    await nextTick()
    expect(wrapper.find('.context-menu .primary').exists()).toBe(false)
    const addButton = wrapper
      .findAll('.context-menu button')
      .find(button => button.text() === '在此新增标签')
    expect(addButton).toBeDefined()
    await addButton!.trigger('click')
    expect(openAreaTagEditor).toHaveBeenLastCalledWith([85, 100])
  })
})
