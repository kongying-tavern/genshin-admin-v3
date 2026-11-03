import { SocketCloseEvent } from './socket-close'
import { SocketLogEvent } from './socket-logs'
import { SocketOpenEvent } from './socket-open'

export { SocketCloseEvent, SocketLogEvent, SocketOpenEvent }

export interface SocketEventMap {
  close: SocketCloseEvent
  open: SocketOpenEvent
  log: SocketLogEvent
}
