import type { RecordPageStep, SocketPageIPC } from './useSocket'
import { diagnosticStep } from '@/database/websocket/diagnostics'
import { EventBus } from '@/utils'

const forwardedEvents = [
  'AppUpdated',
  'UserKickedOut',
  'IconBinaryPurged',
  'ItemBinaryPurged',
  'MarkerBinaryPurged',
  'MarkerLinkageBinaryPurged',
  'NoticeAdded',
  'NoticeDeleted',
  'NoticeUpdated',
  'Pong',
] as const

export const useAppEvent = (ipc: SocketPageIPC, record: RecordPageStep) => {
  const appEvent = new EventBus<Socket.DataEventMap>()

  for (const event of forwardedEvents) {
    ipc.onWithMetadata(event, (metadata, ...args) => {
      try {
        appEvent.emit(event, ...args)
        record(
          metadata,
          diagnosticStep('push-dispatched', 'page', 'success', { settles: 'processing' }),
        )
      } catch (cause) {
        record(
          metadata,
          diagnosticStep('push-processing-failed', 'page', 'failed', {
            reason: 'processing-failed',
            settles: 'processing',
          }),
        )
        throw cause
      }
    })
  }

  return { event: appEvent }
}
