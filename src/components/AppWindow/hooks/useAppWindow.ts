import type { MaybeRef } from 'vue'
import type { WindowContext } from '../core'
import type { MapWindow } from '../types'
import { windowContextKey, windowWorkspaceKey } from './windowWorkspace'

export interface WindowContextHookReturnType {
  id: string
  info: ComputedRef<MapWindow.Info | undefined>
  isOpen: ComputedRef<boolean>
  open: () => Promise<void>
  show: (event?: Event) => Promise<void>
  close: (reason?: MapWindow.RequestCloseReason) => Promise<boolean>
  dispose: (reason: MapWindow.DisposeReason) => Promise<void>
  toggle: (event?: Event) => void
}

type Options = MaybeRef<Omit<MapWindow.WindowOpenParams, 'id'>>

export function useAppWindow(): WindowContext
export function useAppWindow(options: Options): WindowContextHookReturnType
export function useAppWindow(options?: Options): WindowContext | WindowContextHookReturnType {
  const context = inject(windowContextKey)
  if (!context) throw new Error('窗口管理器未初始化')
  if (!options) return context

  const workspace = inject(windowWorkspaceKey, null)
  const id = crypto.randomUUID()
  let disposed = false
  const info = computed(() => context.getWindow(id))
  const isOpen = computed(() => context.isOpen(id))
  const openWindow = () =>
    disposed ? Promise.resolve(false) : context.openWindow({ ...unref(options), id })

  const open = async () => {
    await openWindow()
  }

  const close = (reason?: MapWindow.RequestCloseReason) => context.requestClose(id, reason)
  const dispose = (reason: MapWindow.DisposeReason) => context.dispose(id, reason)

  const show = async (event?: Event) => {
    const trigger = event?.currentTarget ?? document.activeElement
    if (!(await openWindow())) return
    context.unfold(id)
    await nextTick()
    workspace?.focusWindow(id, trigger instanceof HTMLElement ? trigger : undefined)
  }

  const toggle = (event?: Event) => {
    if (context.hasWindow(id)) void close()
    else void show(event)
  }

  if (isRef(options)) {
    watch(options, newOptions => context.updateWindow(id, newOptions), { deep: true })
  }
  watch(
    () => unref(options).enabled?.() ?? true,
    enabled => {
      if (!enabled) void dispose('permission')
    },
    { flush: 'sync' },
  )
  onBeforeUnmount(() => {
    disposed = true
    void dispose('owner')
  })

  return { id, info, isOpen, open, show, close, dispose, toggle }
}
