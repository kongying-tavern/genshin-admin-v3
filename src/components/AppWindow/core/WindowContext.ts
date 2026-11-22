import type { MapWindow } from '../types'
import type { WindowLayout } from './geometry'
import { constrainRect, getDisplayRect, getInitialRect, getMinimumSize } from './geometry'

type Deferred<T> = ReturnType<typeof Promise.withResolvers<T>>

interface WindowInstance {
  options: MapWindow.WindowOpenParams
  generation: number
  opening: Deferred<boolean>
  closing?: Deferred<boolean>
  allowed: boolean
  layout?: WindowLayout
  interactionState?: MapWindow.InteractionState
}

interface QueuedOpen {
  options: MapWindow.WindowOpenParams
  opening: Deferred<boolean>
}

export class WindowContext {
  #instances = new Map<string, WindowInstance>()
  #infos = shallowReactive(new Map<string, MapWindow.Info>())
  #mounted = shallowReactive(new Set<string>())
  #stack = shallowRef<string[]>([])
  #activeId = ref<string>()
  #bounds = shallowRef<MapWindow.Size>()
  #layouts = new Map<string, WindowLayout>()
  #finishing = new Map<string, Promise<void>>()
  #reopening = new Map<string, QueuedOpen>()
  #generation = 0
  #resetting = false

  readonly activeId = computed(() => this.#activeId.value)
  readonly bounds = computed(() => this.#bounds.value)
  readonly panels = computed(() =>
    this.#stack.value.flatMap((id, index) => {
      const info = this.#infos.get(id)
      return info ? [{ info, order: index + 1 }] : []
    }),
  )

  readonly reader: MapWindow.Reader = {
    list: () =>
      this.panels.value
        .filter(({ info }) => this.isOpen(info.id))
        .map(({ info, order }) => {
          const { id, name, normalRect, sizeState, interactionState } = info
          const { x, y, width, height } = normalRect
          return {
            id,
            name,
            sizeState,
            interactionState,
            order,
            size: { width, height },
            translate: { x, y },
          }
        }),
    names: () =>
      this.panels.value
        .filter(({ info }) => this.isOpen(info.id))
        .map(({ info }) => info.name)
        .sort(),
  }

  getWindow = (id: string) => this.#infos.get(id)

  isOpen = (id: string) => this.#mounted.has(id)

  hasWindow = (id: string) => this.#instances.has(id) || this.#reopening.has(id)

  isTop = (id: string) =>
    this.panels.value.findLast(({ info }) => this.isOpen(info.id) && info.sizeState !== 'minimize')
      ?.info.id === id

  setWorkspaceSize = (size: MapWindow.Size) => {
    const { width, height } = size
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
    if (width === this.#bounds.value?.width && height === this.#bounds.value?.height) return
    this.#bounds.value = { width, height }
    for (const instance of this.#instances.values()) this.#publish(instance)
  }

  openWindow = (options: MapWindow.WindowOpenParams): Promise<boolean> => {
    if (this.#resetting) return Promise.resolve(false)
    const { id } = options
    const current = this.#instances.get(id)
    const closing = current?.closing?.promise ?? this.#finishing.get(id)
    if (closing) return this.#queueReopen(options, closing)
    if (current) return current.opening.promise

    const instance: WindowInstance = {
      options,
      generation: ++this.#generation,
      opening: Promise.withResolvers<boolean>(),
      allowed: false,
    }
    this.#instances.set(id, instance)
    this.#stack.value = [...this.#stack.value, id]
    void this.#checkOpen(instance)
    return instance.opening.promise
  }

  markMounted = (info: MapWindow.Info) => {
    const instance = this.#getInstance(info)
    if (!instance || !this.#infos.has(info.id)) return false
    if (!this.#isEnabled(instance)) {
      void this.dispose(info.id, 'permission')
      return false
    }
    this.#mounted.add(info.id)
    instance.opening.resolve(true)
    return true
  }

  failMount = (info: MapWindow.Info) => {
    const instance = this.#getInstance(info)
    if (!instance || this.isOpen(info.id)) return
    void this.#remove(instance, 'openFailed')
  }

  updateWindow = (id: string, options: Partial<Omit<MapWindow.WindowOpenParams, 'id'>>) => {
    const queued = this.#reopening.get(id)
    if (queued) queued.options = { ...queued.options, ...options }
    const instance = this.#instances.get(id)
    if (!instance) return
    instance.options = { ...instance.options, ...options }
    this.#publish(instance)
  }

  requestClose = (id: string, reason: MapWindow.RequestCloseReason = 'user'): Promise<boolean> => {
    this.#cancelReopen(id)
    const instance = this.#instances.get(id)
    if (!instance) return Promise.resolve(this.#finishing.get(id)).then(() => true)
    if (instance.closing) return instance.closing.promise

    const closing = Promise.withResolvers<boolean>()
    instance.closing = closing
    if (this.isOpen(id)) void this.#checkClose(instance, closing, reason)
    else void this.#remove(instance, 'cancelled')
    return closing.promise
  }

  dispose = (id: string, reason: MapWindow.DisposeReason) => {
    this.#cancelReopen(id)
    this.#layouts.delete(id)
    const instance = this.#instances.get(id)
    if (instance) return this.#remove(instance, reason)
    return this.#finishing.get(id) ?? Promise.resolve()
  }

  clearWindow = (reason: 'logout' | 'workspace') => {
    if (this.#resetting) return
    this.#resetting = true
    try {
      this.#layouts.clear()
      for (const id of this.#reopening.keys()) this.#cancelReopen(id)
      for (const instance of this.#instances.values()) void this.#remove(instance, reason)
      this.#finishing.clear()
      this.#activeId.value = undefined
      if (reason === 'workspace') this.#bounds.value = undefined
    } finally {
      this.#resetting = false
    }
  }

  activate = (id: string) => {
    if (!this.isOpen(id) || this.getWindow(id)?.sizeState === 'minimize') return
    if (this.#stack.value.at(-1) !== id)
      this.#stack.value = [...this.#stack.value.filter(key => key !== id), id]
    this.#activeId.value = id
  }

  deactivate = () => {
    this.#activeId.value = undefined
  }

  setMinimized = (id: string, minimized: boolean) => {
    const instance = this.#instances.get(id)
    if (!instance?.layout || instance.layout.minimized === minimized) return
    instance.layout.minimized = minimized
    if (minimized && this.#activeId.value === id) this.deactivate()
    this.#publish(instance)
  }

  toggleMaximize = (id: string) => {
    const instance = this.#instances.get(id)
    if (!instance?.layout || instance.layout.minimized) return
    instance.layout.mode = instance.layout.mode === 'maximize' ? 'default' : 'maximize'
    this.#publish(instance)
  }

  setInteractionState = (info: MapWindow.Info, state: MapWindow.InteractionState) => {
    const instance = this.#getInstance(info)
    if (!instance) return
    instance.interactionState = state
    this.#publish(instance)
  }

  commitRect = (info: MapWindow.Info, rect: MapWindow.Rect) => {
    const instance = this.#getInstance(info)
    const current = this.getWindow(info.id)
    if (
      !instance?.layout
      || !current
      || current.sizeState === 'maximize'
      || current.sizeState === 'minimize'
    )
      return

    const { layout } = instance
    const { displayRect } = current
    const { x, y, width, height } = rect
    if (
      x === displayRect.x
      && y === displayRect.y
      && width === displayRect.width
      && height === displayRect.height
    )
      return

    const previous = layout.normalRect
    layout.normalRect = {
      x: x === displayRect.x ? previous.x : x,
      y: y === displayRect.y ? previous.y : y,
      width: width === displayRect.width ? previous.width : width,
      height: height === displayRect.height ? previous.height : height,
    }
    layout.customized = true
    this.#publish(instance)
  }

  #getInstance = ({ id, generation }: MapWindow.Info) => {
    const instance = this.#instances.get(id)
    return instance?.generation === generation ? instance : undefined
  }

  #isCurrent = (instance: WindowInstance) => this.#instances.get(instance.options.id) === instance

  #isEnabled = (instance: WindowInstance) => {
    try {
      return instance.options.enabled?.() ?? true
    } catch (error) {
      console.error('检查窗口权限失败', error)
      return false
    }
  }

  #checkOpen = async (instance: WindowInstance) => {
    try {
      const allowed =
        this.#isEnabled(instance) && (await (instance.options.beforeOpen?.() ?? true)) === true
      if (!this.#isCurrent(instance)) return
      if (!allowed) {
        await this.#remove(instance)
        return
      }
      if (!this.#isEnabled(instance)) {
        await this.dispose(instance.options.id, 'permission')
        return
      }
      instance.allowed = true
      this.#publish(instance)
    } catch (error) {
      if (!this.#isCurrent(instance)) return
      console.error('打开窗口失败', error)
      await this.#remove(instance)
    }
  }

  #checkClose = async (
    instance: WindowInstance,
    closing: Deferred<boolean>,
    reason: MapWindow.RequestCloseReason,
  ) => {
    let allowed = false
    try {
      allowed = (await (instance.options.beforeClose?.() ?? true)) === true
    } catch (error) {
      if (this.#isCurrent(instance)) console.error('关闭窗口失败', error)
    }
    if (!this.#isCurrent(instance)) return
    if (allowed) {
      await this.#remove(instance, reason, true)
    } else {
      instance.closing = undefined
      closing.resolve(false)
    }
  }

  #publish = (instance: WindowInstance) => {
    const bounds = this.#bounds.value
    if (!bounds || !instance.allowed) return
    const { options, generation, interactionState } = instance
    const { id, key, name, icon } = options
    const initialRect = getInitialRect(options, bounds)
    const cached = this.#layouts.get(id)
    const layout = (instance.layout ??= cached
      ? { ...cached }
      : {
          normalRect: initialRect,
          mode: options.sizeState === 'minimize' ? 'default' : options.sizeState,
          minimized: options.sizeState === 'minimize',
          customized: false,
        })
    if (!layout.customized) layout.normalRect = initialRect
    const minimum = getMinimumSize(options)
    const normalRect = constrainRect(layout.normalRect, bounds, minimum)
    this.#infos.set(id, {
      id,
      key,
      generation,
      name,
      icon,
      minimum,
      normalRect,
      displayRect: getDisplayRect(layout.mode, bounds, normalRect),
      sizeState: layout.minimized ? 'minimize' : layout.mode,
      interactionState,
    })
  }

  #remove = (instance: WindowInstance, reason?: MapWindow.CloseReason, remember = false) => {
    const { id, onClosed } = instance.options
    const finished = Promise.withResolvers<void>()
    this.#finishing.set(id, finished.promise)
    if (remember && instance.layout) this.#layouts.set(id, instance.layout)
    this.#instances.delete(id)
    this.#mounted.delete(id)
    this.#infos.delete(id)
    this.#stack.value = this.#stack.value.filter(key => key !== id)
    if (this.#activeId.value === id) this.deactivate()
    instance.opening.resolve(false)

    void (async () => {
      try {
        if (reason) await onClosed?.(reason)
      } catch (error) {
        console.error('清理窗口失败', error)
      } finally {
        if (this.#finishing.get(id) === finished.promise) this.#finishing.delete(id)
        instance.closing?.resolve(true)
        finished.resolve()
      }
    })()
    return finished.promise
  }

  #queueReopen = (options: MapWindow.WindowOpenParams, closing: Promise<unknown>) => {
    const { id } = options
    const existing = this.#reopening.get(id)
    if (existing) return existing.opening.promise
    const queued = { options, opening: Promise.withResolvers<boolean>() }
    this.#reopening.set(id, queued)
    void closing.then(async () => {
      if (this.#reopening.get(id) !== queued) return
      this.#reopening.delete(id)
      queued.opening.resolve(await this.openWindow(queued.options))
    })
    return queued.opening.promise
  }

  #cancelReopen = (id: string) => {
    const queued = this.#reopening.get(id)
    if (!queued) return
    this.#reopening.delete(id)
    queued.opening.resolve(false)
  }
}
