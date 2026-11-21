import type { PageIPC } from '@/utils/worker'
import { EventBus } from '@/utils'

export const useAppEvent = (ipc: PageIPC<AppSocket.MainEventMap, AppSocket.WorkerEventMap>) => {
  const appEvent = new EventBus<Socket.DataEventMap>()

  // ==================== 应用 ====================
  ipc.on('AppUpdated', () => {
    appEvent.emit('AppUpdated')
  })

  ipc.on('UserKickedOut', () => {
    appEvent.emit('UserKickedOut')
  })

  // ==================== 图标 ====================
  ipc.on('IconBinaryPurged', () => {
    appEvent.emit('IconBinaryPurged')
  })

  // ==================== 物品 ====================
  ipc.on('ItemBinaryPurged', () => {
    appEvent.emit('ItemBinaryPurged')
  })

  // ==================== 点位 ====================
  ipc.on('MarkerBinaryPurged', () => {
    appEvent.emit('MarkerBinaryPurged')
  })

  ipc.on('MarkerLinkageBinaryPurged', () => {
    appEvent.emit('MarkerLinkageBinaryPurged')
  })

  // ==================== 公告 ====================
  ipc.on('NoticeAdded', async id => {
    appEvent.emit('NoticeAdded', id)
  })

  ipc.on('NoticeDeleted', id => {
    appEvent.emit('NoticeDeleted', id)
  })

  ipc.on('NoticeUpdated', id => {
    appEvent.emit('NoticeUpdated', id)
  })

  // ==================== 系统 ====================
  ipc.on('Pong', () => {
    appEvent.emit('Pong')
  })

  return {
    event: appEvent,
  }
}
