interface WebSocketWorkerConfig {
  /** 心跳包 */
  HEARTBEAT: {
    /** 心跳包发送间隔 */
    INTERVAL: number
    /** 超时判定时间 */
    TIMEOUT: number
  }
  /** Socket.IO 往返检测 */
  RTT: {
    INTERVAL: number
    TIMEOUT: number
  }
  /** 页面等待工作线程初始化，以及后台等待页面的送达回执 */
  IPC_TIMEOUT: number
  /** 断线重连 */
  RECONNECT: {
    /** 重连等待时间 */
    DELAY: number
  }
}

/** 连接配置。出于稳定性考虑，连接参数不再通过运行时确定。 */
export const WEBSOCKET_WORKER_CONFIG: WebSocketWorkerConfig = {
  HEARTBEAT: {
    INTERVAL: 10000,
    TIMEOUT: 10000,
  },
  RTT: {
    INTERVAL: 30000,
    TIMEOUT: 10000,
  },
  IPC_TIMEOUT: 10000,
  RECONNECT: {
    DELAY: 3000,
  },
}
