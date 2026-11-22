import type { TweakControlInfo } from '@/components/MapMarkerTweakController/hooks'
import { mount } from '@vue/test-utils'
import { Subject } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide, reactive, ref, watchEffect } from 'vue'
import { useLinkCreate } from '@/components/AppStateBar/components/MarkerLink/hooks/useLinkCreate'
import { WindowContext } from '@/components/AppWindow/core'
import {
  createWindowWorkspace,
  windowContextKey,
  windowWorkspaceKey,
} from '@/components/AppWindow/hooks/windowWorkspace'
import { TextModifier } from '@/components/MapMarkerTweakController/core/modifiers/Text'
import { useMarkerTweaks } from '@/components/MapMarkerTweakController/hooks/useMarkerTweaks'
import { useMultiSelect } from '@/components/MapMarkerTweakController/hooks/useMultiSelect'
import { mapCanvasRef, MapSubject } from '@/shared'
import { useMapMission } from '@/stores/mapState/hooks/useMapMission'

const stores = vi.hoisted(() => ({
  allowed: true,
  linkMarker: vi.fn(),
  tweakMarkers: vi.fn(),
  map: undefined as unknown,
  shortcut: undefined as unknown,
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('element-plus', () => ({ ElMessage: { success: stores.success, error: stores.error } }))
vi.mock('@/components', async () => ({
  useAppWindow: (await import('@/components/AppWindow/hooks')).useAppWindow,
}))
vi.mock('@/packages/map', () => ({ GSMarkerLayer: { layerName: 'marker' } }))
vi.mock('@/stores/access', () => ({ useAccessStore: () => ({ get: () => stores.allowed }) }))
vi.mock('@/stores/markerLink', () => ({
  useMarkerLinkStore: () => ({ linkMarker: stores.linkMarker }),
}))
vi.mock('@/stores', () => ({
  useAccessStore: () => ({ get: () => stores.allowed }),
  useArchiveStore: () => ({ preference: { 'app.shortcutKey.multiselectMarker': 'Ctrl+K' } }),
  useMapStateStore: () => stores.map,
  useShortcutStore: () => stores.shortcut,
  useMarkerStore: () => ({ tweakMarkers: stores.tweakMarkers }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  stores.allowed = true
})

afterEach(() => {
  mapCanvasRef.value = undefined
})

describe('窗口内的地图任务', () => {
  it('关联处置后丢弃旧提交的回调，新提交保持独立的 loading', async () => {
    const previous = Promise.withResolvers<number>()
    const next = Promise.withResolvers<number>()
    stores.linkMarker.mockReturnValueOnce(previous.promise).mockReturnValueOnce(next.promise)
    const { submit, loading, reset } = useLinkCreate()
    const oldSuccess = vi.fn()
    const newSuccess = vi.fn()
    const links = [{ fromId: 1, toId: 2, meta: { key: '1:2' } }]

    const old = submit(links, new Map(), oldSuccess)
    expect(loading.value).toBe(true)
    reset()
    expect(loading.value).toBe(false)
    const current = submit(links, new Map(), newSuccess)

    previous.resolve(1)
    await old
    expect(loading.value).toBe(true)
    expect(oldSuccess).not.toHaveBeenCalled()
    expect(stores.success).not.toHaveBeenCalled()

    next.resolve(2)
    await current
    expect(loading.value).toBe(false)
    expect(newSuccess).toHaveBeenCalledTimes(1)
    expect(stores.success).toHaveBeenCalledTimes(1)
  })

  it('批量操作窗口更换实例后，旧提交不会继续发出通用修改', async () => {
    const custom = Promise.withResolvers<void>()
    const generation = ref(1)
    const modify = vi.fn(() => custom.promise)
    const stage: TweakControlInfo = {
      id: 'title',
      prop: 'markerTitle',
      isCustom: true,
      modifier: new TextModifier({
        field: 'markerTitle',
        label: '标题',
        type: 'replace',
        customModify: modify,
      }),
    }
    const { submit, loading } = useMarkerTweaks({
      markerList: ref([{ id: 123 }]),
      tweakList: ref([stage]),
      tweakData: ref(new Map([['title', {}]])),
      getGeneration: () => generation.value,
    })
    const previous = submit()
    expect(loading.value).toBe(true)
    expect(modify).toHaveBeenCalledTimes(1)
    generation.value += 1
    expect(loading.value).toBe(false)
    custom.resolve()
    await previous
    expect(stores.tweakMarkers).not.toHaveBeenCalled()
    expect(stores.success).not.toHaveBeenCalled()

    stores.allowed = false
    await submit()
    expect(modify).toHaveBeenCalledTimes(1)
  })

  it('画布快捷键打开批量窗口后能框选，登出和卸载共用一次收尾', async () => {
    const context = new WindowContext()
    context.setWorkspaceSize({ width: 1000, height: 600 })
    const shortcut$ = new Subject<{ ev: KeyboardEvent; value: string }>()
    const workspace = defineComponent({
      setup() {
        provide(windowContextKey, context)
        provide(
          windowWorkspaceKey,
          createWindowWorkspace(
            context,
            () => false,
            vi.fn(),
            () => undefined,
          ),
        )
        watchEffect(
          () => {
            for (const { info } of context.panels.value) context.markMounted(info)
          },
          { flush: 'post' },
        )
        return () => h(Owner)
      },
    })
    const focus = reactive(new Map<string, Set<number>>())
    const marker = { id: 123, render: { position: [10, 10] } }
    const lock = vi.fn()
    const temp = vi.fn()
    const finished = vi.fn()
    let controls!: ReturnType<typeof useMultiSelect>
    const Owner = defineComponent({
      setup() {
        stores.shortcut = { shortcut$ }
        stores.map = {
          ...useMapMission(),
          currentLayerMarkers: [marker],
          setCursor: vi.fn(),
          setViewPortLocked: lock,
          setTempMarkers: temp,
          interaction: {
            isFocus: (layer: string, id: number) => focus.get(layer)?.has(id),
            removeFocus: (layer: string) => focus.delete(layer),
            setFocus: (layer: string, ids: Set<number>) => focus.set(layer, ids),
            focusElements: focus,
            setIsPopoverOnHover: vi.fn(),
          },
        }
        controls = useMultiSelect()
        controls.onFinalize(finished)
        return () => [h('canvas', { ref: mapCanvasRef, tabindex: 0 }), h('input')]
      },
    })
    const wrapper = mount(workspace, { attachTo: document.body })
    const canvas = wrapper.get('canvas').element
    const fireShortcut = (target: Element) => {
      const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
      target.dispatchEvent(ev)
      shortcut$.next({ ev, value: 'Ctrl+K' })
    }
    fireShortcut(wrapper.get('input').element)
    expect(controls.isMatched.value).toBe(false)
    canvas.focus()
    fireShortcut(canvas)
    await vi.waitFor(() => expect(context.reader.names()).toEqual(['点位批量操作']))
    expect(document.activeElement).toBe(canvas)

    const drag = (x: number, y: number) =>
      ({
        info: { coordinate: [x, y] },
        event: { leftButton: true, srcEvent: { ctrlKey: true }, center: { x, y } },
      }) as Parameters<typeof MapSubject.drag.next>[0]
    MapSubject.dragStart.next(drag(0, 0))
    MapSubject.drag.next(drag(20, 20))
    expect(lock).toHaveBeenLastCalledWith(true)
    expect(controls.currentSelectedIds.value).toEqual(new Set([123]))

    context.clearWindow('logout')
    expect(lock).toHaveBeenLastCalledWith(false)
    expect(temp).toHaveBeenLastCalledWith('markerMultiSelect', [])
    expect(controls.isMatched.value).toBe(false)
    expect(controls.shape.value).toBeUndefined()
    wrapper.unmount()
    expect(finished).toHaveBeenCalledTimes(1)
  })
})
