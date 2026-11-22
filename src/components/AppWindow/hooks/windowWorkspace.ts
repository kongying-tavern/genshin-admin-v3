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
}

const focus = (element: HTMLElement | undefined) => {
  if (!element?.isConnected || element.closest('[hidden], [inert], :disabled')) return false
  element.focus({ preventScroll: true })
  return document.activeElement === element
}

export const createWindowWorkspace = (
  context: WindowContext,
  isModal: () => boolean,
  focusMap: () => void,
  getContainer: () => HTMLElement | undefined,
) => {
  const windows = shallowReactive(new Map<string, MountedWindow>())
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
    if (!mounted || !context.isOpen(id)) return
    if (target instanceof HTMLElement) mounted.lastFocus = target
    activationHistory.delete(id)
    activationHistory.add(id)
    context.activate(id)
  }

  const focusWindow = (id: string, opener?: HTMLElement) => {
    if (isModal() || !context.isOpen(id)) return false
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

  const restoreOnClose = (info: MapWindow.Info) => {
    const mounted = get(info)
    if (!mounted || isModal() || context.activeId.value !== info.id) return
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

  const onBodyPopupEvent = (event: Event) => {
    const path = event.composedPath()
    for (const [id, { generation }] of windows) {
      if (
        path.some(
          target =>
            target instanceof Element && target.classList.contains(bodyPopupClass(id, generation)),
        )
      ) {
        activate(id, event.type === 'focusin' ? event.target : undefined)
        return
      }
    }
  }

  return {
    get,
    register,
    unregister,
    activate,
    focusWindow,
    restoreOnClose,
    isModal,
    bodyPopupClass,
    onBodyPopupEvent,
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
