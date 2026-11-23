import type {
  DiagnosticIdentity,
  DiagnosticReason,
  DiagnosticStep,
  RttMeasurement,
} from '@/database/websocket/types'

declare global {
  namespace AppSocket {
    interface OpenOptions {
      path: string
      bindingId: string
      query: { userId: string; token?: string }
    }

    // oxlint-disable-next-line typescript/consistent-type-definitions
    type MainEventMap = {
      attach: {
        args: [attemptId: string]
        return: void
      }
      open: {
        args: [url: string, options: OpenOptions]
        return: 'created' | 'reused'
      }
      close: {
        args: []
        return: void
      }
      pong: {
        args: [heartbeatId: string]
        return: void
      }
      receipt: {
        args: [communicationId: string, pageId: string]
        return: void
      }
      resume: {
        args: []
        return: void
      }
      detach: {
        args: []
        return: void
      }
    }

    type WorkerEventMap = {
      init: {
        args: [id: string, attemptId: string, ready: DiagnosticStep]
        return: void
      }
      connectionState: {
        args: [bindingId: string, connection: ConnectionState]
        return: void
      }
      storageError: {
        args: [accountId: string]
        return: void
      }
      rttResult: {
        args: [measurement: RttMeasurement]
        return: void
      }
      ping: {
        args: [heartbeatId: string, trace?: DiagnosticIdentity]
        return: void
      }
    } & {
      [K in WebSocketAPI.WSEventType]: {
        args: WebSocketAPI.WSEventMap[K]
        return: void
      }
    }

    interface SocketEventMap {
      rttcheck: [
        feedback: {
          id: string
          receiveTimestamp?: number
          sendTimestamp?: number
        },
      ]
    }

    interface ConnectionState {
      status: Status
      connectionId: string | null
      changedAt?: number
      reason?: DiagnosticReason
      lastSuccess?: RttMeasurement
    }

    interface MainContext extends ConnectionState {
      id: string
      accountId: string | null
      attachment: 'starting' | 'ready' | 'timeout' | 'failed'
      measurement: RttMeasurement | null
      readonly delay: number | null
      diagnosticsIncomplete: boolean
    }

    type Status = 'INIT' | 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED'
  }
}
