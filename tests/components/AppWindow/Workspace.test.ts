import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, provide, ref } from 'vue'
import AppWindowProvider from '@/components/AppWindow/AppWindowProvider.vue'
import WindowTeleporter from '@/components/AppWindow/components/WindowTeleporter.vue'
import { WindowContext } from '@/components/AppWindow/core'
import { useAppWindow } from '@/components/AppWindow/hooks'
import {
  createWindowWorkspace,
  windowContextKey,
  windowWorkspaceKey,
} from '@/components/AppWindow/hooks/windowWorkspace'
import { mapContainerKey } from '@/shared'

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ auth: {}, onBeforeLogout: vi.fn() }),
}))

const mountWorkspace = (onClosed = vi.fn()) => {
  const context = new WindowContext()
  context.setWorkspaceSize({ width: 640, height: 360 })
  const modal = ref(false)
  let handle!: ReturnType<typeof useTestWindow>

  const useTestWindow = () =>
    useAppWindow({
      key: 'test',
      name: '测试窗口',
      width: 400,
      height: 320,
      x: 30,
      y: 20,
      onClosed,
    })
  const Owner = defineComponent({
    setup() {
      const window = useTestWindow()
      handle = window
      return () => [
        h('button', { class: 'opener', onClick: window.show }, '打开'),
        h(
          WindowTeleporter,
          { info: window.info.value },
          {
            default: () => h('input', { class: 'window-input' }),
          },
        ),
      ]
    },
  })
  const Root = defineComponent({
    setup() {
      const container = ref<HTMLElement>()
      const map = ref<HTMLCanvasElement>()
      provide(mapContainerKey, container)
      provide(windowContextKey, context)
      provide(
        windowWorkspaceKey,
        createWindowWorkspace(
          context,
          () => modal.value,
          () => map.value?.focus(),
          () => container.value,
        ),
      )
      return () =>
        h('div', { ref: container, inert: modal.value || undefined }, [
          h('canvas', { ref: map, tabindex: 0 }),
          h(Owner),
          h(AppWindowProvider),
        ])
    },
  })
  const wrapper = mount(Root, { attachTo: document.body })
  return { wrapper, context, handle, modal, onClosed }
}

const pointer = (
  target: HTMLElement,
  type: string,
  pointerId: number,
  x: number,
  y: number,
  isPrimary = true,
) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.assign(event, { pointerId, isPrimary })
  target.dispatchEvent(event)
}

describe('窗口宿主', () => {
  it('最小化移入浮动任务栏，恢复业务内容和焦点，关闭时回到入口', async () => {
    const { wrapper, handle, onClosed } = mountWorkspace()
    const opener = wrapper.get<HTMLButtonElement>('.opener').element
    opener.focus()
    await wrapper.get('.opener').trigger('click')
    await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('测试窗口'))
    const input = wrapper.get<HTMLInputElement>('.window-input').element
    input.value = '保留的输入'
    input.focus()

    const minimize = wrapper.get<HTMLButtonElement>('button[aria-label="最小化窗口"]')
    minimize.element.focus()
    await minimize.trigger('click')
    const task = wrapper.get('button[aria-label="恢复测试窗口"]')
    expect(document.activeElement).toBe(task.element)
    expect(handle.isOpen.value).toBe(true)
    expect(handle.info.value?.sizeState).toBe('minimize')
    expect(input.closest('.window-instance')?.getAttribute('style')).toContain('display: none')
    await task.trigger('click')
    expect(wrapper.find('.taskbar-item').exists()).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(wrapper.get('.window-input').element).toBe(input)
    expect(input.value).toBe('保留的输入')

    expect(await handle.close()).toBe(true)
    await nextTick()
    expect(wrapper.find('.window-content').exists()).toBe(false)
    expect(document.activeElement).toBe(opener)
    expect(onClosed).toHaveBeenCalledExactlyOnceWith('user')
    wrapper.unmount()
  })

  it('多个最小化窗口独立恢复，窗口标题栏跟随焦点', async () => {
    const { wrapper, context, handle } = mountWorkspace()
    await handle.show()
    await context.openWindow({ id: 'second', key: 'second', name: '第二个窗口' })
    const firstPanel = wrapper.get<HTMLElement>(`[aria-labelledby="window-title-${handle.id}"]`)
    const secondPanel = wrapper.get<HTMLElement>('[aria-labelledby="window-title-second"]')
    const focusTitle = (panel: typeof firstPanel) =>
      panel.get<HTMLElement>('.header-title').element.focus()
    const minimize = (panel: typeof firstPanel) =>
      panel.get('button[aria-label="最小化窗口"]').trigger('click')

    expect(firstPanel.classes()).toContain('is-active')
    expect(secondPanel.classes()).not.toContain('is-active')
    await minimize(firstPanel)
    focusTitle(secondPanel)
    await nextTick()
    expect(secondPanel.classes()).toContain('is-active')
    await minimize(secondPanel)
    expect(wrapper.findAll('.taskbar-item').map(item => item.text())).toEqual([
      '测试窗口',
      '第二个窗口',
    ])
    await wrapper.get('button[aria-label="恢复测试窗口"]').trigger('click')
    expect(firstPanel.classes()).toContain('is-active')
    expect(wrapper.findAll('.taskbar-item').map(item => item.text())).toEqual(['第二个窗口'])
    wrapper.get<HTMLCanvasElement>('canvas').element.focus()
    await nextTick()
    expect(firstPanel.classes()).not.toContain('is-active')
    wrapper.unmount()
  })

  it('最大化与还原先提交真实尺寸，来回切换时只动画变换和透明度', async () => {
    const { wrapper, handle } = mountWorkspace()
    await handle.open()
    const panel = wrapper.get<HTMLElement>('.window-instance').element
    vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(
      () =>
        new DOMRect(
          parseFloat(panel.style.left),
          parseFloat(panel.style.top),
          parseFloat(panel.style.width),
          parseFloat(panel.style.height),
        ),
    )
    const cancel = vi.fn()
    const layouts: string[] = []
    const animate = vi.fn((_: Keyframe[]) => {
      layouts.push(panel.style.width)
      return { cancel, finished: new Promise(() => {}) }
    })
    Object.assign(panel, { animate })

    await wrapper.get('button[aria-label="最大化窗口"]').trigger('click')
    await nextTick()
    await wrapper.get('button[aria-label="还原窗口"]').trigger('click')
    await nextTick()
    expect(layouts).toEqual(['640px', '400px'])
    expect(animate.mock.calls.map(([keyframes]) => keyframes)).toEqual([
      [
        { transform: `translate(30px, 20px) scale(0.625, ${320 / 360})`, opacity: 1 },
        { transform: 'none', opacity: 1 },
      ],
      [
        { transform: 'translate(-30px, -20px) scale(1.6, 1.125)', opacity: 1 },
        { transform: 'none', opacity: 1 },
      ],
    ])
    expect(cancel).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(cancel).toHaveBeenCalledTimes(2)
  })

  it('捕获单个主指针，抬起提交最后位置，丢捕获和卸载只收尾一次', async () => {
    const { wrapper, context, handle, onClosed } = mountWorkspace()
    const commit = vi.spyOn(context, 'commitRect')
    await handle.open()
    const title = wrapper.get<HTMLElement>('.header-title').element
    const release = vi.fn()
    Object.assign(title, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: release,
    })

    pointer(title, 'pointerdown', 1, 60, 34)
    pointer(title, 'pointerdown', 2, 65, 60, false)
    pointer(title, 'pointerup', 2, 100, 90, false)
    pointer(title, 'pointermove', 1, 70, 50)
    pointer(document.body, 'pointerup', 1, 80, 64)
    pointer(title, 'lostpointercapture', 1, 80, 64)
    expect(context.getWindow(handle.id)?.normalRect).toEqual({
      x: 50,
      y: 40,
      width: 400,
      height: 320,
    })
    expect(commit).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledExactlyOnceWith(1)

    pointer(title, 'pointerdown', 3, 90, 48)
    wrapper.unmount()
    pointer(title, 'pointerup', 3, 110, 70)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenLastCalledWith(3)
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(context.reader.list()).toEqual([])
  })

  it('模态中止指针预览，操作菜单支持方向键和方向按钮', async () => {
    const { wrapper, context, handle, modal } = mountWorkspace()
    await handle.open()
    const title = wrapper.get<HTMLElement>('.header-title').element
    const input = wrapper.get<HTMLInputElement>('.window-input').element
    input.focus()
    Object.assign(title, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
    })
    pointer(title, 'pointerdown', 1, 40, 30)
    pointer(title, 'pointermove', 1, 160, 170)
    modal.value = true
    await nextTick()
    input.blur()
    pointer(title, 'pointerup', 1, 160, 170)
    expect(context.getWindow(handle.id)?.normalRect.x).toBe(30)
    modal.value = false
    await nextTick()
    expect(document.activeElement).toBe(input)

    await wrapper.get('button[aria-label="窗口操作"]').trigger('click')
    const buttons = () => wrapper.get('.window-actions').findAll('button')
    await buttons()[0].trigger('click')
    await wrapper.get('.window-actions').trigger('keydown', { key: 'ArrowRight' })
    await wrapper.get('button[aria-label="向下"]').trigger('click')
    await buttons()
      .find(button => button.text() === '确认')!
      .trigger('click')
    expect(context.getWindow(handle.id)?.normalRect).toEqual({
      x: 38,
      y: 28,
      width: 400,
      height: 320,
    })
    wrapper.unmount()
  })
})
