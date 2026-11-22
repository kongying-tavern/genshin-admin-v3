import type { WindowContext } from '../core'
import type { MapWindow } from '../types'
import { adjustRect } from '../core/geometry'
import { useWindowWorkspace } from './windowWorkspace'

type NudgeMode = 'move' | 'se'

interface Operation {
  info: MapWindow.Info
  mode: MapWindow.Operation
  bounds: MapWindow.Size
  pointer?: {
    id: number
    target: HTMLElement
    origin: MapWindow.Coordinate
    listeners: AbortController
  }
}

export const useWindowOperation = (context: WindowContext, getInfo: () => MapWindow.Info) => {
  const workspace = useWindowWorkspace()
  const preview = shallowRef<MapWindow.Rect>()
  const nudgeMode = ref<NudgeMode>()
  let operation: Operation | undefined
  let frame: number | undefined
  let latestPoint: MapWindow.Coordinate | undefined

  const canStart = (mode: MapWindow.Operation) => {
    const state = getInfo().sizeState
    return state !== 'maximize' && (state !== 'minimize' || mode === 'move')
  }

  const start = (mode: MapWindow.Operation) => {
    const bounds = context.bounds.value
    if (!bounds || !canStart(mode) || !workspace.startOperation(cancel)) return undefined
    operation = { info: getInfo(), mode, bounds }
    context.setInteractionState(operation.info, 'manual')
    return operation
  }

  const finish = (rect?: MapWindow.Rect) => {
    if (!operation) return
    const { info, pointer } = operation
    operation = undefined
    workspace.endOperation(cancel)
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    latestPoint = undefined
    preview.value = undefined
    nudgeMode.value = undefined
    if (rect) context.commitRect(info, rect)
    context.setInteractionState(info, 'default')
    if (pointer) {
      pointer.listeners.abort()
      if (pointer.target.hasPointerCapture(pointer.id))
        pointer.target.releasePointerCapture(pointer.id)
    }
  }

  const cancel = () => finish()

  const startPointer = (event: PointerEvent, mode: MapWindow.Operation) => {
    const target = event.currentTarget
    if (!event.isPrimary || event.button !== 0 || !(target instanceof HTMLElement)) return
    const started = start(mode)
    if (!started) return
    try {
      target.setPointerCapture(event.pointerId)
      const listeners = new AbortController()
      const options = { capture: true, signal: listeners.signal }
      started.pointer = {
        target,
        id: event.pointerId,
        origin: workspace.localPointer(event),
        listeners,
      }
      window.addEventListener('pointermove', movePointer, options)
      window.addEventListener('pointerup', endPointer, options)
      window.addEventListener('pointercancel', cancelPointer, options)
      window.addEventListener('lostpointercapture', cancelPointer, options)
      workspace.capturePointer()
      event.preventDefault()
    } catch {
      cancel()
    }
  }

  const pointerRect = (current: Operation, point: MapWindow.Coordinate) => {
    const { info, mode, bounds, pointer } = current
    if (!pointer) return undefined
    return adjustRect(
      info.displayRect,
      { x: point.x - pointer.origin.x, y: point.y - pointer.origin.y },
      mode,
      bounds,
      info.minimum,
    )
  }

  const movePointer = (event: PointerEvent) => {
    const current = operation
    if (!current || current.pointer?.id !== event.pointerId) return
    latestPoint = workspace.localPointer(event)
    if (frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      if (operation === current && latestPoint) preview.value = pointerRect(current, latestPoint)
    })
  }

  const endPointer = (event: PointerEvent) => {
    if (operation?.pointer?.id !== event.pointerId) return
    finish(pointerRect(operation, workspace.localPointer(event)))
  }

  const cancelPointer = (event: PointerEvent) => {
    if (operation?.pointer?.id === event.pointerId) cancel()
  }

  const startNudge = (mode: NudgeMode) => {
    if (start(mode)) nudgeMode.value = mode
  }

  const nudge = (delta: MapWindow.Coordinate) => {
    if (!operation || !nudgeMode.value) return
    const { info, mode, bounds } = operation
    preview.value = adjustRect(preview.value ?? info.displayRect, delta, mode, bounds, info.minimum)
  }

  const confirmNudge = () => finish(preview.value)

  watch([context.bounds, () => getInfo().sizeState], cancel, { flush: 'sync' })
  onBeforeUnmount(cancel)

  return {
    preview,
    nudgeMode,
    startPointer,
    startNudge,
    nudge,
    confirmNudge,
    cancel,
  }
}
