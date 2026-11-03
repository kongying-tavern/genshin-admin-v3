import { acceptHMRUpdate, defineStore } from 'pinia'
import { useSocketStore } from './socket'

interface BroadcastMeta {
  /** 页面 id */
  id: string
  /** 页面创建时间 */
  time: number
}

interface BroadcastChannelPayload {
  type: string
  param: unknown
}

export const useBroadcastStore = defineStore('broadcast-channel', () => {
  const socketStore = useSocketStore()

  /** 当前页面信息 */
  const meta = ref<BroadcastMeta>({
    id: `temp-${Date.now()}`,
    time: Date.now(),
  })

  /** 多页面状态 */
  const state = ref({
    clients: new Map<string, BroadcastMeta>([[meta.value.id, meta.value]]),
  })

  const clients = computed(() =>
    [...state.value.clients.values()].sort(({ time: ta }, { time: tb }) => ta - tb),
  )

  /** 是否为主控页面 */
  const isMaster = computed(
    () => clients.value.findIndex(client => client.id === meta.value.id) === 0,
  )

  /** 状态同步频道 */
  const bc = new BroadcastChannel('state-sync')

  const actionMap: Record<string, (param: unknown) => void> = {
    /** 广播自身存在 */
    displaySelf: data => {
      const clientMeta = data as BroadcastMeta
      if (state.value.clients.has(clientMeta.id)) return
      state.value.clients.set(clientMeta.id, clientMeta)
    },
    /** 有其他页面接入 */
    register: data => {
      const clientMeta = data as BroadcastMeta
      state.value.clients.set(clientMeta.id, clientMeta as BroadcastMeta)
      bc.postMessage({ type: 'displaySelf', param: toRaw(meta.value) })
    },
    /** 有其他页面关闭 */
    unregister: data => {
      const clientMeta = data as BroadcastMeta
      state.value.clients.delete(clientMeta.id)
    },
  }

  bc.addEventListener('message', (ev: MessageEvent<BroadcastChannelPayload>) => {
    const { type, param } = ev.data
    actionMap[type]?.(param)
  })

  socketStore.ipc.on('init', pageId => {
    if (!meta.value.id.startsWith('temp-')) return
    meta.value.id = pageId.toUpperCase()
    bc.postMessage({ type: 'register', param: toRaw(meta.value) })
  })

  const init = () => {}

  window.addEventListener('beforeunload', () => {
    bc.postMessage({ type: 'unregister', param: toRaw(meta.value) })
  })

  return {
    init,
    meta,
    state,
    clients,
    isMaster,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBroadcastStore, import.meta.hot))
}
