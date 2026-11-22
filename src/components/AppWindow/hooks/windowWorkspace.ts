import type { InjectionKey } from 'vue'
import type { WindowContext } from '../core'
import type { MapWindow } from '../types'

export const windowContextKey: InjectionKey<WindowContext> = Symbol('windowContext')

interface WindowElements {
  panel: HTMLElement
  title: HTMLElement
  content: HTMLElement
  popups: HTMLElement
}

interface MountedWindow extends WindowElements {
  generation: number
  opener?: HTMLElement
  lastFocus?: HTMLElement
  restoreFrom?: DOMRect
}

const focus = (element: HTMLElement | undefined, preventScroll = true) => {
  if (!element?.isConnected || element.closest('[hidden], [inert], :disabled')) return false
  element.focus({ preventScroll })
  return document.activeElement === element
}

export const createWindowWorkspace = (
  context: WindowContext,
  isModal: () => boolean,
  focusMap: () => void,
  getContainer: () => HTMLElement | undefined,
) => {
  const windows = shallowReactive(new Map<string, MountedWindow>())
  const taskButtons = new Map<string, HTMLElement>()
  const activationHistory = new Set<string>()

  const get = (info: MapWindow.Info) => {
    const mounted = windows.get(info.id)
    return mounted?.generation === info.generation ? mounted : undefined
  }

  const register = (info: MapWindow.Info, elements: WindowElements) => {
    if (context.getWindow(info.id)?.generation !== info.generation) return
    windows.set(info.id, { ...elements, generation: info.generation })
    if (!context.markMounted(info)) windows.delete(info.id)
  }

  const unregister = (info: MapWindow.Info) => {
    if (!get(info)) return
    windows.delete(info.id)
    activationHistory.delete(info.id)
  }

  const activate = (id: string, target?: EventTarget | null) => {
    if (isModal()) return
    const mounted = windows.get(id)
    if (!mounted || !context.isOpen(id) || context.getWindow(id)?.sizeState === 'minimize') return
    if (target instanceof HTMLElement && !target.hasAttribute('data-window-minimize'))
      mounted.lastFocus = target
    activationHistory.delete(id)
    activationHistory.add(id)
    context.activate(id)
  }

  const focusWindow = (id: string, opener?: HTMLElement) => {
    if (isModal() || !context.isOpen(id) || context.getWindow(id)?.sizeState === 'minimize')
      return false
    const mounted = windows.get(id)
    if (!mounted) return false
    if (opener && !mounted.panel.contains(opener)) mounted.opener = opener
    activate(id)
    return focus(mounted.lastFocus) || focus(mounted.title)
  }

  const focusFallback = () => {
    for (const id of [...activationHistory].reverse()) {
      if (focusWindow(id)) return
    }
    focusMap()
  }

  const setTaskButton = (id: string, button?: HTMLElement) => {
    if (button) taskButtons.set(id, button)
    else taskButtons.delete(id)
  }

  const takeTaskRect = (id: string) => {
    const mounted = windows.get(id)
    const stored = mounted?.restoreFrom
    if (mounted) mounted.restoreFrom = undefined
    return stored ?? taskButtons.get(id)?.getBoundingClientRect()
  }

  const minimizeWindow = async (id: string) => {
    if (isModal()) return
    const info = context.getWindow(id)
    if (!info || info.sizeState === 'minimize') return
    const wasActive = context.activeId.value === id
    context.setMinimized(id, true)
    if (!wasActive) return

    await nextTick()
    const current = context.getWindow(id)
    if (
      isModal()
      || context.activeId.value
      || current?.generation !== info.generation
      || current.sizeState !== 'minimize'
    )
      return
    if (!focus(taskButtons.get(id), false)) focusFallback()
  }

  const showWindow = async (id: string, opener?: HTMLElement) => {
    if (isModal()) return
    const info = context.getWindow(id)
    if (!info || !context.isOpen(id)) return
    const mounted = get(info)
    if (info.sizeState === 'minimize') {
      if (mounted) mounted.restoreFrom = taskButtons.get(id)?.getBoundingClientRect()
      context.setMinimized(id, false)
    }
    await nextTick()
    if (context.getWindow(id)?.generation === info.generation) focusWindow(id, opener)
  }

  const restoreOnClose = (info: MapWindow.Info) => {
    const mounted = get(info)
    if (!mounted || isModal()) return
    const focused =
      context.activeId.value === info.id || document.activeElement === taskButtons.get(info.id)
    if (!focused) return
    void nextTick(() => {
      if (isModal() || context.activeId.value) return
      if (!focus(mounted.opener)) focusFallback()
    })
  }

  let cancelCurrentOperation: (() => void) | undefined
  const pointerActive = ref(false)
  const startOperation = (cancel: () => void) => {
    if (cancelCurrentOperation || isModal()) return false
    cancelCurrentOperation = cancel
    return true
  }
  const endOperation = (cancel: () => void) => {
    if (cancelCurrentOperation !== cancel) return
    cancelCurrentOperation = undefined
    pointerActive.value = false
  }
  const cancelOperation = () => {
    if (!cancelCurrentOperation) return false
    cancelCurrentOperation()
    return true
  }
  const localPointer = (event: PointerEvent) => {
    const box = getContainer()?.getBoundingClientRect()
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
  }

  let modalOpener: HTMLElement | undefined
  let modalCycle = false
  watch(
    isModal,
    modal => {
      if (!modal) return
      if (!modalCycle) {
        modalOpener =
          document.activeElement instanceof HTMLElement ? document.activeElement : undefined
        modalCycle = true
      }
      cancelOperation()
    },
    { flush: 'sync', immediate: true },
  )
  watch(
    isModal,
    modal => {
      if (modal || !modalCycle) return
      const opener = modalOpener
      modalOpener = undefined
      modalCycle = false
      if (!focus(opener)) focusFallback()
    },
    { flush: 'post' },
  )

  const bodyPopupClass = (id: string, generation: number) => `map-window-popup-${id}-${generation}`

  const getEventWindow = (event: Event) => {
    const path = event.composedPath()
    for (const [id, { generation, panel }] of windows) {
      if (
        path.includes(panel)
        || path.some(
          target =>
            target instanceof Element && target.classList.contains(bodyPopupClass(id, generation)),
        )
      ) {
        return id
      }
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || isModal()) return
    const id = getEventWindow(event)
    if (id) activate(id)
  }

  const onFocusIn = (event: FocusEvent) => {
    if (isModal()) return
    const id = getEventWindow(event)
    if (id) activate(id, event.target)
    else context.deactivate()
  }

  const onWindowBlur = () => {
    cancelOperation()
    const target = document.activeElement
    if (!(target instanceof HTMLIFrameElement)) return
    // iframe 内获得焦点时，父文档收到的是 window blur。
    for (const [id, { panel }] of windows) {
      if (panel.contains(target)) {
        activate(id, target)
        return
      }
    }
  }

  return {
    get,
    register,
    unregister,
    minimizeWindow,
    showWindow,
    setTaskButton,
    takeTaskRect,
    restoreOnClose,
    isModal,
    bodyPopupClass,
    onPointerDown,
    onFocusIn,
    onWindowBlur,
    startOperation,
    endOperation,
    cancelOperation,
    localPointer,
    pointerActive: computed(() => pointerActive.value),
    capturePointer: () => {
      pointerActive.value = true
    },
  }
}

export const windowWorkspaceKey: InjectionKey<ReturnType<typeof createWindowWorkspace>> =
  Symbol('windowWorkspace')

export const useWindowWorkspace = () => {
  const workspace = inject(windowWorkspaceKey)
  if (!workspace) throw new Error('窗口工作区未初始化')
  return workspace
}
