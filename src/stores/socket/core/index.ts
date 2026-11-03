import type { Socket } from 'socket.io-client'
import type { SocketEventMap } from './events'
import { io } from 'socket.io-client'
import { SocketLogEvent } from './events'

/**
 * `socket.io` promise 化适配器
 */
export class AppSocket extends EventTarget {
  #url: string
  #context = {
    socket: null as Socket | null,
    connectPromise: null as Promise<Socket> | null,
    closePromise: null as Promise<void> | null,
  }

  constructor(url: string) {
    super()
    this.#url = url
    super.dispatchEvent(new SocketLogEvent(`SocketAdapter initialized with URL: "${url}"`))
  }

  #resetContext = () => {
    this.#context = {
      socket: null,
      connectPromise: null,
      closePromise: null,
    }
  }

  open = async () => {
    if (this.#context.socket) return this.#context.socket
    if (this.#context.connectPromise) return this.#context.connectPromise
    const promise = new Promise<Socket>((resolve, reject) => {
      this.dispatchEvent(new SocketLogEvent(`Attempting to connect to "${this.#url}"`))
      const url = new URL(this.#url)
      const socket = io(url.origin, {
        path: url.pathname,
        transports: ['websocket'],
      })
      socket.on('connect', () => {
        this.dispatchEvent(new SocketLogEvent(`Connected to "${this.#url}" with id "${socket.id}"`))
        this.#context.socket = socket
        resolve(socket)
      })
      socket.on('disconnect', () => {
        this.dispatchEvent(new SocketLogEvent(`Disconnected from "${this.#url}"`))
        this.#resetContext()
      })
      socket.on('connect_error', err => {
        this.dispatchEvent(
          new SocketLogEvent(`Connection to "${this.#url}" failed: ${err.message}`),
        )
        this.#context.connectPromise = null
        reject(err)
      })
    })
    this.#context.connectPromise = promise
    return promise
  }

  close = async () => {
    const { socket } = this.#context
    if (!socket) return
    if (this.#context.closePromise) return this.#context.closePromise
    this.dispatchEvent(new SocketLogEvent(`Closing connection to "${this.#url}"`))
    const promise = new Promise<void>(resolve => {
      socket.close()
      socket.on('disconnect', () => {
        this.#resetContext()
        resolve()
      })
    })
    this.#context.closePromise = promise
    return promise
  }

  addEventListener<K extends keyof SocketEventMap>(
    type: K,
    listener: (ev: SocketEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener, options)
  }

  removeEventListener<K extends keyof SocketEventMap>(
    type: K,
    listener: (ev: SocketEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListener,
    options?: EventListenerOptions | boolean,
  ): void {
    super.removeEventListener(type, listener, options)
  }
}
