import type { GlobalDialogService } from './GlobalDialogService'
import type { GlobalDialogOptions } from './types'

export const context = new (class GlobalDialogContext {
  visible = ref(false)

  queue: GlobalDialogService[] = []

  resolves = new Map<string, ((payload: unknown) => void)[]>()

  current = shallowRef<GlobalDialogOptions>()

  afterClosed = () => {
    const nextDialog = this.queue.shift()
    this.current.value = nextDialog?._getOptions()
    if (nextDialog) this.visible.value = true
  }

  open = (instance: GlobalDialogService) => {
    if (this.current.value) {
      this.queue.push(instance)
      if (this.current.value.component === instance._getOptions().component)
        this.close(this.current.value.id, undefined)
      return
    }
    this.current.value = instance._getOptions()
    this.visible.value = true
  }

  close = (targetId: string | undefined, payload: unknown) => {
    if (targetId === undefined) return
    if (targetId === this.current.value?.id) {
      this.resolves.get(targetId)?.forEach(callback => callback(payload))
      this.resolves.delete(targetId)
      this.visible.value = false
      return
    }
    const index = this.queue.findIndex(instance => instance._getId() === targetId)
    if (index < 0) return
    this.queue.splice(index, 1)
  }

  clear = () => {
    for (const instance of this.queue.splice(0)) {
      const id = instance._getId()
      this.resolves.get(id)?.forEach(resolve => resolve(undefined))
      this.resolves.delete(id)
    }
    this.close(this.current.value?.id, undefined)
  }
})()

Reflect.set(globalThis, 'context', context)
