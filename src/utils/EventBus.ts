export type EventHandler<P> = (...payloads: P extends unknown[] ? P : []) => void

export class EventBus<EventMap> {
  // oxlint-disable-next-line typescript/no-explicit-any
  #handlers: Record<any, any[]> = {}

  on = <T extends keyof EventMap>(event: T, handler: EventHandler<EventMap[T]>): (() => void) => {
    if (!this.#handlers[event]) this.#handlers[event] = []
    this.#handlers[event].push(handler)
    return () => this.off(event, handler)
  }

  once = <T extends keyof EventMap>(event: T, handler: EventHandler<EventMap[T]>): (() => void) => {
    const onceHandler: EventHandler<EventMap[T]> = (...payloads) => {
      handler(...payloads)
      this.off(event, onceHandler)
    }
    this.on(event, onceHandler)
    return () => this.off(event, onceHandler)
  }

  emit = <T extends keyof EventMap>(
    event: T,
    ...payloads: EventMap[T] extends unknown[] ? EventMap[T] : unknown[]
  ): void => {
    const eventHandlers = this.#handlers[event]
    if (eventHandlers) eventHandlers.forEach(handler => handler(...payloads))
  }

  off = <T extends keyof EventMap>(event: T, handler: EventHandler<EventMap[T]>): void => {
    const eventHandlers = this.#handlers[event]
    if (eventHandlers) {
      this.#handlers[event] = eventHandlers.filter(existingHandler => existingHandler !== handler)
    }
  }

  clear = (): void => {
    this.#handlers = {}
  }
}
