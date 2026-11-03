import type { NotificationHandle } from 'element-plus'
import { ElNotification } from 'element-plus'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useArchiveStore, useUserStore } from '..'
import { useAppEvent, useMessageList, useSocket } from './hooks'

/** WebSocket 状态管理 */
export const useSocketStore = defineStore('socket', () => {
  const archiveStore = useArchiveStore()
  const userStore = useUserStore()

  const noticeEvents = computed(() => {
    return new Set(archiveStore.currentArchive.body.Preference['socket.setting.noticeEvents'])
  })

  /** 正在通知的事件 */
  const isNoticing = ref(new Map<WebSocketAPI.WSEventType, NotificationHandle>())

  const notice = (key: WebSocketAPI.WSEventType, ...options: Parameters<typeof ElNotification>) => {
    // 检查用户设置是否允许通知
    if (!noticeEvents.value.has(key)) return
    // 清除同类通知
    isNoticing.value.get(key)?.close()
    // 本次通知
    isNoticing.value.set(key, ElNotification(...options))
  }

  const { context, ipc, socketEvent, open, close } = useSocket()

  ipc.on('AppUpdated', () => {
    ElNotification.warning({
      title: '系统提示',
      message: '应用已更新，页面将在 5 分钟后重载。',
      duration: 0,
    })
    window.setTimeout(
      () => {
        window.location.replace(`${window.location.origin}?t=${Date.now()}`)
      },
      5 * 60 * 1000,
    )
  })

  ipc.on('UserKickedOut', () => {
    ElNotification.error({
      title: '系统提示',
      message: '您已被管理员强制下线。',
      duration: 0,
    })
    userStore.logout()
  })

  const { event: appEvent } = useAppEvent(ipc)
  const { messageList, clearMessageList } = useMessageList(appEvent)

  watch(
    () => userStore.info?.id,
    userId => {
      if (userId === undefined) return close()
      open(`${userId}`)
    },
  )

  return {
    context,
    ipc,
    socketEvent,
    appEvent,
    messageList,
    clearMessageList,
    notice,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSocketStore, import.meta.hot))
}
