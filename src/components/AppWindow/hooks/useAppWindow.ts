import type { MaybeRef } from 'vue'
import type { MapWindow } from '../types'
import { WindowContext } from '../core'

export interface WindowContextHookReturnType {
  context: WindowContext
  id: ReturnType<typeof crypto.randomUUID>
  info: ComputedRef<MapWindow.Info | undefined>
  isOpen: ComputedRef<boolean>
  open: () => void
  close: () => void
  toggle: () => void
}

let context: WindowContext

export function useAppWindow(): WindowContext
export function useAppWindow(
  options: MaybeRef<Omit<MapWindow.WindowOpenParams, 'id'>>,
): WindowContextHookReturnType
export function useAppWindow(options?: MaybeRef<Omit<MapWindow.WindowOpenParams, 'id'>>) {
  if (!context) context = new WindowContext()

  if (!options) return context

  const id = crypto.randomUUID()

  const info = computed(() => {
    return context.getWindow(id)
  })

  const isOpen = computed(() => {
    return info.value !== undefined
  })

  const open = () => {
    context.openWindow({
      ...unref(options),
      id,
    })
  }

  const close = () => {
    context.closeWindow(id)
  }

  const toggle = () => {
    isOpen.value ? close() : open()
  }

  if (isRef(options))
    watch(options, newOptions => context.updateWindow(id, newOptions), { deep: true })

  onUnmounted(() => {
    close()
  })

  return {
    context,
    id,
    info,
    isOpen,
    open,
    close,
    toggle,
  }
}
