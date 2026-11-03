import { useUserStore } from '@/stores/user'
import { EventBus } from '@/utils'
import { PageIPC } from '@/utils/worker'
import SocketWorkerURL from '@/worker/webSocket/socket.worker?worker&url'

export const useSocket = () => {
  const context = ref<AppSocket.MainContext>({
    delay: 0,
    id: '',
    status: 'INIT',
  })

  const socketEvent = new EventBus<WebSocketAPI.WSEventMap>()

  const openHook = createEventHook<void>()
  const closeHook = createEventHook<void>()

  /**
   * 由于移动端目前暂未支持 SharedWorker，所以使用 Worker 代替
   * @data 2025-10-14
   */
  const socketWorker = new ('SharedWorker' in globalThis ? SharedWorker : Worker)(SocketWorkerURL, {
    type: 'module',
    name: 'Socket 工作线程',
  })

  const messagePort = (() => {
    if (socketWorker instanceof Worker) return socketWorker
    socketWorker.port.start()
    return socketWorker.port
  })()

  const ipc = new PageIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap>(messagePort)

  ipc.on('init', id => {
    context.value.id = id
  })

  ipc.on('delayChange', delay => {
    context.value.delay = delay
  })

  ipc.on('statusChange', status => {
    context.value.status = status
  })

  // 处理心跳 ping，响应 pong
  ipc.on('ping', () => {
    ipc.invoke('pong', context.value.id)
  })

  const close = async () => {
    await ipc.invoke('close')
  }

  const open = async (userId: string) => {
    const url = new URL(import.meta.env.VITE_WS_BASE)
    // 后端（Rust WS_AUTH_REQUIRED）要求握手携带 token，否则 401
    const { auth } = useUserStore()
    const { accessToken } = auth
    await ipc.invoke('open', url.origin, {
      path: url.pathname,
      query: {
        userId,
        ...(accessToken ? { token: accessToken } : {}),
      },
    })
  }

  return {
    context,
    ipc,
    socketEvent,
    onOpen: openHook.on,
    onClose: closeHook.on,
    close,
    open,
  }
}
