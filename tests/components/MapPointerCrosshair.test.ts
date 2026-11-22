import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import MapPointerCrosshair from '@/components/MapPointerCrosshair/MapPointerCrosshair.vue'
import {
  mapCanvasRef,
  mapContainerHeightKey,
  mapContainerWidthKey,
  mapViewStateKey,
} from '@/shared'

const tile = reactive({
  currentTileConfig: { tile: { center: [10, 20] as DTO.Coordinate2D } },
  toMarkerCoordinate: ([x, y]: DTO.Coordinate2D): DTO.Coordinate2D => {
    const [ox, oy] = tile.currentTileConfig.tile.center
    return [x - ox, y - oy]
  },
})

vi.mock('@/stores', () => ({ useTileStore: () => tile }))

const viewState = ref({
  target: [400, 300] as DTO.Coordinate2D,
  zoom: 0,
})
const width = ref(800)
const height = ref(600)
const getCoordinate = vi.fn(([x, y]: DTO.Coordinate2D): DTO.Coordinate2D => {
  const { target, zoom } = viewState.value
  return [
    target[0] + (x - width.value / 2) / 2 ** zoom,
    target[1] + (y - height.value / 2) / 2 ** zoom,
  ]
})

const mountCrosshair = () =>
  mount(MapPointerCrosshair, {
    props: { getCoordinate },
    global: {
      provide: {
        [mapViewStateKey]: viewState,
        [mapContainerWidthKey]: width,
        [mapContainerHeightKey]: height,
      },
    },
  })

const renderFrame = async () => {
  await nextTick()
  vi.advanceTimersToNextFrame()
  await nextTick()
}

describe('地图全幅十字线', () => {
  let canvas: HTMLCanvasElement
  let wrapper: ReturnType<typeof mountCrosshair>

  const pointer = (type: string, x = 0, y = 0, pointerType = 'mouse') =>
    canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerType }))

  beforeEach(async () => {
    vi.useFakeTimers()
    getCoordinate.mockClear()
    viewState.value = { target: [400, 300], zoom: 0 }
    tile.currentTileConfig.tile.center = [10, 20]
    width.value = 800
    height.value = 600
    canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, 24, 800, 600))
    mapCanvasRef.value = canvas
    wrapper = mountCrosshair()
    await nextTick()
  })

  afterEach(() => {
    if (wrapper.exists()) wrapper.unmount()
    mapCanvasRef.value = undefined
    vi.useRealTimers()
  })

  it('合并同一帧的指针事件，并显示轴读数和两套坐标', async () => {
    pointer('pointerenter', 26, 34)
    pointer('pointermove', 51, 56)
    pointer('pointermove', 89, 117)
    expect(getCoordinate).not.toHaveBeenCalled()
    await renderFrame()

    const overlay = wrapper.get<HTMLElement>('.map-pointer-crosshair')
    expect(overlay.element.style.getPropertyValue('--pointer-x')).toBe('73px')
    expect(overlay.element.style.getPropertyValue('--pointer-y')).toBe('93px')
    expect(wrapper.findAll('.axis-x').map(node => node.text())).toEqual(['X 73.00', 'X 73.00'])
    expect(wrapper.findAll('.axis-y').map(node => node.text())).toEqual(['Y 93.00', 'Y 93.00'])
    expect(wrapper.findAll('dd').map(node => node.text())).toEqual([
      '[73.00, 93.00]',
      '[63.00, 73.00]',
    ])
    expect(getCoordinate).toHaveBeenCalledExactlyOnceWith([73, 93])
    expect(canvas.getBoundingClientRect).toHaveBeenCalledOnce()
    await renderFrame()
    expect(getCoordinate).toHaveBeenCalledOnce()
  })

  it('指针静止时也跟随地图缩放、地区偏移和画布尺寸变化', async () => {
    pointer('pointerenter', 216, 124)
    await renderFrame()
    expect(wrapper.get('dd').text()).toBe('[200.00, 100.00]')

    viewState.value.zoom = 1
    tile.currentTileConfig.tile.center = [20, 30]
    await renderFrame()
    expect(wrapper.findAll('dd').map(node => node.text())).toEqual([
      '[300.00, 200.00]',
      '[280.00, 170.00]',
    ])
    expect(canvas.getBoundingClientRect).toHaveBeenCalledOnce()

    vi.mocked(canvas.getBoundingClientRect).mockReturnValue(new DOMRect(20, 30, 600, 400))
    width.value = 600
    height.value = 400
    await renderFrame()
    expect(getCoordinate).toHaveBeenLastCalledWith([196, 94])
    expect(wrapper.get('dd').text()).toBe('[348.00, 247.00]')
    expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(2)
  })

  it('左上方的轴读数避开侧栏入口和中央读数框', async () => {
    pointer('pointerenter', 24, 115)
    await renderFrame()

    const { style } = wrapper.get<HTMLElement>('.map-pointer-crosshair').element
    const topLabel = parseFloat(style.getPropertyValue('--label-top'))
    const readout = parseFloat(style.getPropertyValue('--readout-y'))
    expect(topLabel).toBeGreaterThan(readout + 44)
    expect(style.getPropertyValue('--label-x')).toBe('50px')
  })

  it('忽略触摸手势，离开画布或卸载时取消待处理的帧', async () => {
    pointer('pointerenter', 30, 40, 'touch')
    await renderFrame()
    expect(getCoordinate).not.toHaveBeenCalled()
    expect(wrapper.find('.map-pointer-crosshair').exists()).toBe(false)

    pointer('pointerenter', 30, 40)
    await renderFrame()
    expect(getCoordinate).toHaveBeenCalledOnce()

    pointer('pointermove', 50, 60)
    pointer('pointerleave')
    await renderFrame()
    expect(getCoordinate).toHaveBeenCalledOnce()
    expect(wrapper.find('.map-pointer-crosshair').exists()).toBe(false)

    pointer('pointerenter', 30, 40)
    wrapper.unmount()
    pointer('pointermove', 60, 70)
    await renderFrame()
    expect(getCoordinate).toHaveBeenCalledOnce()
  })
})
