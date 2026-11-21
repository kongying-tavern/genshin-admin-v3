import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { wsdb } from '@/database'
import { WorkerIPC } from '@/utils/worker/worker-ipc'

declare const globalThis: WorkerGlobalScope

type SocketIPC = WorkerIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap>
type ServerEvent = keyof WebSocketAPI.WSEventMap
type OpenOptions = AppSocket.MainEventMap['open']['args'][1]

interface Connection {
  socket: Socket
  ports: Set<SocketIPC>
  status: AppSocket.Status
  delay: number
}

const connections = new Map<string, Connection>()
const heartbeatInterval = 10000
const heartbeatTimeout = 10000

function openConnection(url: string, options: OpenOptions): Connection {
  const socket = io(url, {
    path: options.path,
    query: options.query,
    transports: ['websocket'],
    autoConnect: false,
  })
  const connection: Connection = { socket, ports: new Set(), status: 'CONNECTING', delay: 999 }
  const setStatus = (status: AppSocket.Status) => {
    connection.status = status
    connection.ports.forEach(ipc => ipc.emit('statusChange', status))
  }

  let timer: number | undefined
  let request: { id: string; time: number } | undefined
  function checkRtt() {
    if (!socket.connected) return
    request = { id: crypto.randomUUID(), time: Date.now() }
    socket.emit('rttcheck', { id: request.id })
    timer = globalThis.setTimeout(checkRtt, 30000)
  }
  const stopRtt = () => {
    globalThis.clearTimeout(timer)
    request = undefined
  }
  socket.on(
    'rttcheck',
    ({ id, receiveTimestamp, sendTimestamp }: AppSocket.SocketEventMap['rttcheck'][0]) => {
      if (request?.id !== id) return
      connection.delay = Date.now() - request.time - (sendTimestamp - receiveTimestamp)
      connection.ports.forEach(ipc => ipc.emit('delayChange', connection.delay))
    },
  )
  socket.on('connect', () => {
    setStatus('OPEN')
    stopRtt()
    checkRtt()
  })
  socket.on('connect_error', () => setStatus('CLOSED'))
  socket.io.on('reconnect_attempt', () => setStatus('CONNECTING'))
  socket.on('disconnect', () => {
    stopRtt()
    setStatus('CLOSED')
  })

  socket.on('message', async (message: string) => {
    try {
      const { event, data } = JSON.parse(message) as {
        event: ServerEvent
        data: AppSocket.WorkerEventMap[ServerEvent]['args'][0]
      }
      connection.ports.forEach(ipc =>
        ipc.emit(event, ...([data] as AppSocket.WorkerEventMap[ServerEvent]['args'])),
      )
      await wsdb.logs.add({ t: Date.now(), msg: message, type: 0 })
    } catch (err) {
      const error = err instanceof Error ? err : new Error('无法读取 WebSocket 消息')
      connection.ports.forEach(ipc => ipc.emit('error', error.message, error.stack ?? ''))
    }
  })
  return connection
}

function registerPort(port: MessagePort | DedicatedWorkerGlobalScope) {
  const id = crypto.randomUUID()
  const ipc = new WorkerIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap>(port)
  let key: string | undefined
  let heartbeat: number | undefined

  const detach = () => {
    if (!key) return
    const current = connections.get(key)
    current?.ports.delete(ipc)
    if (current && !current.ports.size) {
      current.socket.disconnect()
      connections.delete(key)
    }
    key = undefined
  }

  ipc.handle('open', (url, options) => {
    const nextKey = JSON.stringify([url, options.path, options.query.userId, options.query.token])
    if (key !== nextKey) detach()
    key = nextKey
    const existing = connections.get(key)
    const connection = existing ?? openConnection(url, options)
    connections.set(key, connection)
    connection.ports.add(ipc)
    ipc.emit('statusChange', connection.status)
    ipc.emit('delayChange', connection.delay)
    if (!connection.socket.active) connection.socket.connect()
    return existing ? 'reused' : 'created'
  })
  ipc.handle('close', () => {
    detach()
    ipc.emit('statusChange', 'CLOSED')
  })

  const ping = () => {
    heartbeat = globalThis.setTimeout(() => {
      ipc.emit('ping', id)
      heartbeat = globalThis.setTimeout(() => {
        detach()
        ipc.emit('statusChange', 'CLOSED')
      }, heartbeatTimeout)
    }, heartbeatInterval)
  }
  ipc.handle('pong', () => {
    globalThis.clearTimeout(heartbeat)
    ping()
  })
  ipc.emit('init', id)
  ipc.emit('statusChange', 'INIT')
  ipc.emit('delayChange', 999)
  ping()
}

if (Object.prototype.toString.call(globalThis) === '[object SharedWorkerGlobalScope]') {
  const scope = globalThis as SharedWorkerGlobalScope
  scope.addEventListener('connect', event => {
    const port = event.ports[0]
    registerPort(port)
    port.start()
  })
} else {
  registerPort(globalThis as DedicatedWorkerGlobalScope)
}
