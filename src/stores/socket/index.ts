import type { NotificationHandle } from 'element-plus'
import { ElNotification } from 'element-plus'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useArchiveStore, useUserStore } from '..'
import { useMapEntitySync } from '../mapEntitySync'
import { useAppEvent, useMessageList, useSocket } from './hooks'
import { Logger } from '@/utils/logger'

const logger = new Logger('Socket')

/** WebSocket 状态管理 */
export const useSocketStore = defineStore('socket', () => {
  const archiveStore = useArchiveStore()
  const userStore = useUserStore()
  const sync = useMapEntitySync()

  const noticeEvents = computed(() => {
    return new Set(archiveStore.preference['socket.setting.noticeEvents'])
  })

  /** 正在通知的事件 */
  const isNoticing = ref(new Map<WebSocketAPI.WSEventType, NotificationHandle>())
  watch(
    () => sync.scope,
    () => {
      for (const notice of isNoticing.value.values()) notice.close()
      isNoticing.value.clear()
    },
    { flush: 'sync' },
  )

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
  const { messageList, clearMessageList } = useMessageList(appEvent, () => sync.scope)

  const credentials = computed<{ id: number; token: string } | undefined>(previous => {
    const { auth, info } = userStore
    if (!auth.accessToken || !info?.id || info.id !== auth.userId) return undefined
    // 重连核对会重新读取用户资料，同一组握手凭证应沿用原引用。
    if (previous?.id === info.id && previous.token === auth.accessToken) return previous
    return { id: info.id, token: auth.accessToken }
  })
  const connected = shallowRef<typeof credentials.value>()
  const hasCurrentCredentials = computed(() => {
    const current = credentials.value
    return Boolean(current && connected.value === current)
  })
  watch(
    credentials,
    (current, _, onCleanup) => {
      connected.value = undefined
      let expired = false
      onCleanup(() => {
        expired = true
      })
      const action = current ? open(String(current.id)) : close()
      void action
        .then(() => {
          if (!expired) connected.value = current
        })
        .catch(cause => logger.error(cause))
    },
    { immediate: true },
  )
  useEventListener(document, 'visibilitychange', () => {
    const current = credentials.value
    if (document.hidden || !current || context.value.status !== 'CLOSED') return
    void open(String(current.id)).catch(cause => logger.error(cause))
  })

  return {
    context,
    ipc,
    socketEvent,
    appEvent,
    messageList,
    clearMessageList,
    notice,
    hasCurrentCredentials,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSocketStore, import.meta.hot))
}
