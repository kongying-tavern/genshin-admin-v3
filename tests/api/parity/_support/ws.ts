import { io } from 'socket.io-client'
import { wsBase } from './env'
import { semanticOf } from './observer'

/**
 * REST → WebSocket 事件联动采集
 *
 * 前端实际订阅方式（src/worker/webSocket/socket.worker.ts:146）：
 *   socket.on('message', msg => JSON.parse(msg) -> { event, data, time })
 * 因此这里直连各环境的 VITE_WS_BASE，监听 `message` 通道并还原事件名与 payload 结构。
 * 不使用任何模拟事件，全部来自真实后端推送。
 */

export type WsEventRecord = {
  event: string
  dataShape: unknown
  topKeys: string[]
  timeShape: string
}

export type WsCapture = {
  handshake: 'with-token' | 'without-token'
  connected: boolean
  connectError?: string
  events: WsEventRecord[]
  settleMs: number
}

const CONNECT_TIMEOUT_MS = 8_000

export async function collectWsEvents(options: {
  token?: string | null
  userId: string
  action: () => Promise<void>
  settleMs?: number
}): Promise<WsCapture> {
  const { token, userId, action, settleMs = 1_500 } = options
  const url = new URL(wsBase)
  const query: Record<string, string> = { userId }
  if (token) query.token = token

  const events: WsEventRecord[] = []
  const socket = io(url.origin, {
    path: url.pathname,
    query,
    transports: ['websocket'],
    reconnection: false,
    timeout: CONNECT_TIMEOUT_MS,
    forceNew: true,
  })

  socket.on('message', (raw: unknown) => {
    let payload: any = raw
    if (typeof raw === 'string') {
      try { payload = JSON.parse(raw) } catch { payload = { event: '__unparsable__', data: raw } }
    }
    if (!payload || typeof payload !== 'object') return
    const lengths: Record<string, number> = {}
    const dataShape = semanticOf(payload.data ?? null, 'data', 0, lengths)
    events.push({
      event: String(payload.event ?? '__missing_event__'),
      dataShape,
      topKeys: payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
        ? Object.keys(payload.data)
        : Array.isArray(payload.data) ? ['<array>'] : [],
      timeShape: typeof (payload.time ?? ''),
    })
  })

  // 连接层错误不能变成未处理异常；结果统一由 connected / connectError 反映
  socket.on('error', () => {})

  const connectResult = await new Promise<{ connected: boolean; error?: string }>(resolve => {
    const timer = setTimeout(() => resolve({ connected: false, error: 'connect timeout' }), CONNECT_TIMEOUT_MS)
    socket.on('connect', () => {
      clearTimeout(timer)
      resolve({ connected: true })
    })
    socket.on('connect_error', (error: Error) => {
      clearTimeout(timer)
      resolve({ connected: false, error: String(error?.message ?? error) })
    })
  })

  try {
    await action()
    // 给广播事件留出到达窗口
    await new Promise(resolve => setTimeout(resolve, settleMs))
  } finally {
    socket.removeAllListeners()
    socket.close()
  }

  return {
    handshake: token ? 'with-token' : 'without-token',
    connected: connectResult.connected,
    connectError: connectResult.error,
    events,
    settleMs,
  }
}
