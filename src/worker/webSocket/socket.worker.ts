/* oxlint-disable no-console */
import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { wsdb } from '@/database'
import { WorkerIPC } from '@/utils/worker/worker-ipc'

declare const globalThis: WorkerGlobalScope

type ServerEvents = {
  [K in keyof WebSocketAPI.WSEventMap]: {
    event: K
    data: WebSocketAPI.WSEventMap[K][0]
  }
}[keyof WebSocketAPI.WSEventMap]

/** 10 秒发送一次 ping */
const heartbeatInterval = 10000
/** 10 秒内没有响应则认为断连 */
const heartbeatTimeout = 10000

const context = {
  status: 'INIT' as AppSocket.Status,
  socket: null as Socket | null,
  delay: 999,
  openPromise: null as Promise<Socket> | null,
  ports: new Map<string, WorkerIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap>>(),
  rtt: {
    interval: 30000,
    time: 0,
    id: crypto.randomUUID(),
  },
}

// DEBUG
Reflect.set(globalThis, 'context', context)

const startRttCheckLoop = (socket: Socket) => {
  console.log('start rtt check loop')
  let timer: number | null = null

  const requestRttCheck = () => {
    context.rtt.id = crypto.randomUUID()
    context.rtt.time = Date.now()
    socket.emit('rttcheck', { id: context.rtt.id })
  }

  socket.on(
    'rttcheck',
    ({ id, receiveTimestamp, sendTimestamp }: AppSocket.SocketEventMap['rttcheck'][0]) => {
      if (id !== context.rtt.id) return
      const endTime = Date.now()
      const totalRtt = endTime - context.rtt.time
      const serverProcessTime = sendTimestamp - receiveTimestamp
      const rtt = totalRtt - serverProcessTime
      context.delay = rtt
      context.ports.forEach(ipc => ipc.emit('delayChange', rtt))
      setTimeout(() => requestRttCheck(), context.rtt.interval)
    },
  )

  socket.on('disconnect', () => {
    console.log('socket disconnected, stop rtt check loop')
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  })

  requestRttCheck()
}

// ====================    event listener    ====================

/** 启动心跳机制 */
const startHeartbeat = (
  id: string,
  ipc: WorkerIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap>,
) => {
  let disconnectTimer: number | null = null

  const startNextPing = () => {
    globalThis.setTimeout(() => {
      ipc.emit('ping', id)
      disconnectTimer = globalThis.setTimeout(() => {
        context.ports.delete(id)
      }, heartbeatTimeout)
    }, heartbeatInterval)
  }

  startNextPing()

  ipc.handle('pong', () => {
    if (!disconnectTimer) return
    globalThis.clearTimeout(disconnectTimer)
    disconnectTimer = null
    startNextPing()
  })
}

// sharedworker 下需要管理所有页面
if (Object.prototype.toString.call(globalThis) === '[object SharedWorkerGlobalScope]') {
  const scope = globalThis as SharedWorkerGlobalScope

  scope.addEventListener('connect', ev => {
    const id = crypto.randomUUID()
    const port = ev.ports[0]

    const ipc = new WorkerIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap>(port)
    port.start()
    context.ports.set(id, ipc)

    // ====================   event handler    ====================

    /** 开启 socket 连接 */
    ipc.handle('open', async (url, options) => {
      if (context.socket) {
        const { query = {} } = context.socket.io.opts
        const isReusable = options.query.userId === query.userId
        console.log('check if socket is reusable', isReusable, { options, query })
        if (isReusable) {
          console.log('Reusable socket found')
          context.status = 'OPEN'
          ipc.emit('statusChange', 'OPEN')
          return 'reused'
        }
      }

      if (context.openPromise) {
        console.log('socket is connecting by another page')
        ipc.emit('statusChange', 'CONNECTING')
        await context.openPromise
        return 'reused'
      }

      const { resolve, reject, promise } = Promise.withResolvers<Socket>()

      context.status = 'CONNECTING'
      context.ports.forEach(ipc => ipc.emit('statusChange', context.status))

      console.log('socket is connecting by page', id)

      // 初始化 socket 连接
      const socket = io(url, {
        path: options.path,
        query: options.query,
        transports: ['websocket'],
      })

      startRttCheckLoop(socket)

      socket.on('message', async (message: string) => {
        try {
          const payload = JSON.parse(message) as ServerEvents
          // oxlint-disable-next-line typescript/no-explicit-any
          context.ports.forEach(ipc => ipc.emit(payload.event, payload.data as any))
          await wsdb.logs.add({
            t: Date.now(),
            msg: message,
            type: 0,
          })
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Unknown error')
          context.ports.forEach(ipc => ipc.emit('error', error.message, error.stack || ''))
        }
      })

      socket.on('connect', () => {
        resolve(socket)
        context.socket = socket
        context.openPromise = null
        context.status = 'OPEN'
        context.ports.forEach(ipc => ipc.emit('statusChange', context.status))
      })

      socket.on('connect_error', () => {
        reject(new Error('Low level connection can not be established'))
        context.status = 'CLOSED'
        context.ports.forEach(ipc => ipc.emit('statusChange', context.status))
      })

      socket.on('disconnect', () => {
        context.status = 'CLOSED'
        context.ports.forEach(ipc => ipc.emit('statusChange', context.status))
      })

      context.openPromise = promise
      await promise
      console.log('socket connected by page', id)
      return 'created'
    })

    /** 关闭 socket 连接 */
    ipc.handle('close', async () => {
      if (context.openPromise) await context.openPromise
      if (!context.socket) return
      context.socket.close()
      context.socket = null
    })

    ipc.emit('init', id)
    ipc.emit('statusChange', context.status)
    ipc.emit('delayChange', context.delay)
    startHeartbeat(id, ipc)
  })
}
// worker 下只需要管理单独页面
else {
  const scope = globalThis as DedicatedWorkerGlobalScope
  const id = crypto.randomUUID()
  const ipc = new WorkerIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap>(scope)
  ipc.emit('init', id)
  ipc.emit('statusChange', context.status)
  ipc.emit('delayChange', context.delay)
}
