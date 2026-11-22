import type { GenshinMapProps, GenshinMapViewState } from '@/packages/map/src/types'
import { mount } from '@vue/test-utils'
import { assert, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import GenshinMapDeck from '@/packages/map/src/components/GenshinMapDeck.vue'
import { GSTileLayer } from '@/packages/map/src/core/gsTileLayer'

const { createMap, finalize, setProps } = vi.hoisted(() => ({
  createMap: vi.fn<(canvas: HTMLCanvasElement, props: GenshinMapProps) => void>(),
  finalize: vi.fn(),
  setProps: vi.fn<(props: GenshinMapProps) => void>(),
}))

vi.mock('@/packages/map/src/core', () => ({
  GenshinMap: class {
    constructor(canvas: HTMLCanvasElement, props: GenshinMapProps) {
      createMap(canvas, { ...props })
    }
    finalize = finalize
    setProps = setProps
  },
}))

it('WebGL 恢复后只更换画布和渲染实例，沿用最新视口和图层配置', async () => {
  const tile = new GSTileLayer({ code: 'test', size: [512, 1024], tilesOffset: [16, 32] })
  const wrapper = mount(GenshinMapDeck, {
    attachTo: document.body,
    attrs: { tabindex: 0 },
    props: { viewState: { target: [0, 0], zoom: 0 }, layers: [tile] },
  })
  await nextTick()
  const canvas = wrapper.get('canvas').element
  canvas.focus()
  const loss = new Event('webglcontextlost', { cancelable: true })
  canvas.dispatchEvent(loss)
  expect(loss.defaultPrevented).toBe(true)
  expect(createMap).toHaveBeenCalledTimes(1)

  const viewState: GenshinMapViewState = { target: [125, 90], zoom: 2 }
  await wrapper.setProps({ viewState, layers: [false, [tile]] })
  await wrapper.get('canvas').trigger('webglcontextrestored')
  expect(createMap).toHaveBeenCalledTimes(2)
  expect(finalize).toHaveBeenCalledTimes(1)
  const [newCanvas, props] = createMap.mock.calls[1]
  expect(newCanvas).toBe(wrapper.get('canvas').element)
  expect(newCanvas).not.toBe(canvas)
  expect(document.activeElement).toBe(newCanvas)
  expect(wrapper.emitted('update:canvasRef')?.at(-1)).toEqual([newCanvas])
  expect(props.initialViewState).toEqual(viewState)
  const group = props.layers?.[1]
  assert(Array.isArray(group))
  const [restoredTile] = group
  assert(restoredTile instanceof GSTileLayer)
  expect(restoredTile).not.toBe(tile)
  expect(restoredTile.id).toBe(tile.id)
  expect(restoredTile.props.extent).toEqual(tile.props.extent)

  await wrapper.setProps({ layers: [tile, null] })
  expect(setProps.mock.lastCall?.[0].layers?.[0]).toBe(restoredTile)
  await wrapper.get('canvas').trigger('webglcontextlost')
  await wrapper.get('canvas').trigger('webglcontextrestored')
  const nextTile = createMap.mock.lastCall?.[1].layers?.[0]
  expect(nextTile).toBeInstanceOf(GSTileLayer)
  expect(nextTile).not.toBe(restoredTile)
  wrapper.unmount()
  expect(finalize).toHaveBeenCalledTimes(3)
})
