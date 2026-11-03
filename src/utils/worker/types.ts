export interface EventMap {
  [channel: string]: {
    args: unknown[]
    return?: unknown
  }
}

export interface RequestMessage<Args extends unknown[] = unknown[]> {
  type: 'request'
  id: string
  channel: string
  args: Args
}

export interface ResponseMessage<Result = unknown> {
  type: 'response'
  id: string
  result?: Result
  error?: { message: string; stack?: string }
}

export interface Resolver {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

/**
 * 用于兼容 `Worker` 或 `SharedWorker` 或 `ServiceWorker`
 */
export interface PortLike {
  postMessage(message: unknown, transfer: Transferable[]): void
  postMessage(message: unknown, options?: StructuredSerializeOptions): void
  addEventListener<K extends keyof MessagePortEventMap>(
    type: K,
    listener: (this: MessagePort, ev: MessagePortEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener<K extends keyof MessagePortEventMap>(
    type: K,
    listener: (this: MessagePort, ev: MessagePortEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
}
