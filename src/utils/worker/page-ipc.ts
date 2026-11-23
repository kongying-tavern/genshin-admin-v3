import type { EventMap, PortLike, RequestMessage, Resolver } from './types'
import { isRequest, isResponse } from './utils'
import { WorkerError } from './worker-error'

export class PageIPC<
  MainEvents extends EventMap = EventMap,
  WorkerEvents extends EventMap = EventMap,
  Metadata = never,
> {
  #port: PortLike | undefined
  #resolvers = new Map<string, Resolver>()
  #listeners = new Map<string, Set<(message: RequestMessage<unknown[], Metadata>) => void>>()

  constructor(
    worker?: PortLike,
    onRequest?: (
      message: RequestMessage<unknown[], Metadata>,
      hasListeners: boolean,
    ) => boolean | void,
  ) {
    if (typeof window === 'undefined') throw new Error('PageIPC 只能在渲染线程中使用')

    this.#port = worker
    worker?.addEventListener('message', ({ data }) => {
      if (isRequest(data)) {
        const message = data as RequestMessage<unknown[], Metadata>
        const listeners = this.#listeners.get(message.channel)
        if (onRequest?.(message, !!listeners?.size) === false) return
        for (const listener of listeners ?? []) {
          try {
            listener(message)
          } catch (error) {
            queueMicrotask(() => {
              throw error
            })
          }
        }
        return
      }
      if (!isResponse(data)) return
      const resolver = this.#resolvers.get(data.id)
      if (!resolver) return
      this.#resolvers.delete(data.id)
      if (data.error) {
        resolver.reject(new WorkerError(data.error.message, { stack: data.error.stack }))
        return
      }
      resolver.resolve(data.result)
    })
  }

  invoke = async <C extends keyof MainEvents>(
    channel: C,
    ...args: MainEvents[C]['args']
  ): Promise<MainEvents[C]['return']> => {
    const id = crypto.randomUUID()
    return new Promise<MainEvents[C]['return']>((resolve, reject) => {
      this.#resolvers.set(id, { resolve, reject })
      try {
        this.#post({ type: 'request', id, channel: channel as string, args })
      } catch (error) {
        this.#resolvers.delete(id)
        reject(error)
      }
    })
  }

  send = <C extends keyof MainEvents>(channel: C, ...args: MainEvents[C]['args']): void => {
    this.#post({
      type: 'request',
      id: crypto.randomUUID(),
      channel: channel as string,
      args,
      notify: true,
    })
  }

  rejectPending = (reason: Error) => {
    for (const { reject } of this.#resolvers.values()) reject(reason)
    this.#resolvers.clear()
  }

  #post = (message: RequestMessage) => {
    if (!this.#port) throw new WorkerError('浏览器后台未接入')
    this.#port.postMessage(message)
  }

  on = <C extends keyof WorkerEvents>(
    channel: C,
    handler: (...args: WorkerEvents[C]['args']) => void,
  ): (() => void) => this.onWithMetadata(channel, (_, ...args) => handler(...args))

  onWithMetadata = <C extends keyof WorkerEvents>(
    channel: C,
    handler: (metadata: Metadata | undefined, ...args: WorkerEvents[C]['args']) => void,
  ): (() => void) => {
    const name = channel as string
    const listeners = this.#listeners.get(name) ?? new Set()
    this.#listeners.set(name, listeners)
    const listener = ({ metadata, args }: RequestMessage<unknown[], Metadata>) =>
      handler(metadata, ...(args as WorkerEvents[C]['args']))
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (!listeners.size) this.#listeners.delete(name)
    }
  }
}
