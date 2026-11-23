import type { EventMap, RequestMessage, ResponseMessage } from './types'
import { isRequest } from './utils'

type Handler<A extends unknown[] = unknown[], T = void> = (...args: A) => MaybePromise<T>
type MaybePromise<T> = Promise<T> | T
interface PortLike {
  addEventListener: MessagePort['addEventListener']
  postMessage: MessagePort['postMessage']
}

export class WorkerIPC<
  MainEvents extends EventMap = EventMap,
  WorkerEvents extends EventMap = EventMap,
  Metadata = never,
> {
  #handlers: Map<keyof MainEvents, Handler> = new Map()
  #port: PortLike

  #createMessageListener = (port: PortLike) => {
    return async (ev: MessageEvent<unknown>) => {
      const { data } = ev
      if (!isRequest(data)) return
      const handler = this.#handlers.get(data.channel)
      try {
        if (!handler) throw new Error(`Channel ${data.channel} is unhandle`)
        const result = await handler(...data.args)
        if (data.notify) return
        const response = {
          type: 'response',
          id: data.id,
          result,
        } satisfies ResponseMessage
        port.postMessage(response)
      } catch (err) {
        if (data.notify) return
        const { message, stack } = err as Error
        port.postMessage({
          type: 'response',
          id: data.id,
          error: { message, stack },
        } satisfies ResponseMessage<never>)
      }
    }
  }

  constructor(port: PortLike) {
    this.#port = port
    this.#port.addEventListener('message', this.#createMessageListener(this.#port))
  }

  /**
   * ### 处理来自主线程的事件
   * - 同名 handler 只能注册一个
   */
  handle = <C extends keyof MainEvents>(
    channel: C,
    handler: Handler<MainEvents[C]['args'], MaybePromise<MainEvents[C]['return']>>,
  ): void => {
    if (this.#handlers.has(channel))
      throw new Error(`Attempted to register a second handler for '${String(channel)}'`)
    this.#handlers.set(channel, handler as Handler)
  }

  /** 移除 handler */
  removeHandler = <C extends keyof MainEvents>(
    channel: C,
    handler: (...args: MainEvents[C]['args']) => MaybePromise<MainEvents[C]['return']>,
  ): void => {
    this.#handlers.set(channel, handler as Handler)
  }

  /** 向主线程发送事件 */
  emit = <C extends keyof WorkerEvents>(channel: C, ...args: WorkerEvents[C]['args']): void => {
    this.emitWithMetadata(undefined, channel, ...args)
  }

  emitWithMetadata = <C extends keyof WorkerEvents>(
    metadata: Metadata | undefined,
    channel: C,
    ...args: WorkerEvents[C]['args']
  ): void => {
    const payload: RequestMessage<WorkerEvents[C]['args'], Metadata> = {
      id: crypto.randomUUID(),
      type: 'request',
      channel: channel as string,
      args,
      ...(metadata === undefined ? {} : { metadata }),
    }
    this.#port.postMessage(payload)
  }
}
