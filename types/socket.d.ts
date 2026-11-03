declare namespace AppSocket {
  /** 主线程可以发送的事件 */
  // oxlint-disable-next-line typescript/consistent-type-definitions
  type MainEventMap = {
    /** 初始化 */
    init: {
      args: [pageId: string]
      return: void
    }
    /** 开启 socket 连接 */
    open: {
      args: [
        url: string,
        options: {
          path: string
          query: {
            userId: string
            /** 后端握手鉴权：Rust `WS_AUTH_REQUIRED` 要求 token（query 或 Authorization 头） */
            token?: string
          }
        },
      ]
      return: 'created' | 'reused'
    }
    /** 关闭 socket 连接 */
    close: {
      args: []
      return: void
    }
    /** 响应心跳 ping */
    pong: {
      args: [id: string]
      return: void
    }
  }

  /** worker 线程可以发送的事件 */
  type WorkerEventMap = {
    /** 分配页面 id */
    init: {
      args: [id: string]
      return: void
    }
    /** socket 时延改变 */
    delayChange: {
      args: [delay: number]
      return: void
    }
    /** socket 状态改变 */
    statusChange: {
      args: [status: Status]
      return: void
    }
    /** socket 错误 */
    error: {
      args: [message: string, stack: string]
      return: void
    }
    /** 心跳 ping */
    ping: {
      args: [pageId: string]
      return: void
    }
  } & {
    [K in keyof WebSocketAPI.WSEventMap]: {
      args: WebSocketAPI.WSEventMap[K]
      return: void
    }
  }

  interface SocketEventMap {
    rttcheck: [
      feedback: {
        id: string
        receiveTimestamp: number
        sendTimestamp: number
      },
    ]
  }

  /** 主线程 ws 上下文 */
  interface MainContext {
    /** 页面 id */
    id: string
    /** socket 状态 */
    status: Status
    /** 当前延迟 */
    delay: number
  }

  /** socket 当前状态 */
  type Status =
    | 'INIT' // 初始化，主线程请求 sharedworker 中 socket 的状态
    | 'CONNECTING' // 连接中
    | 'OPEN' // 已连接
    | 'CLOSING' // 连接断开中
    | 'CLOSED' // 已断开
}
