import type { NoticeVo } from '@/api/alova/globals'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { context as noticeContext } from '@/components/AppNotice/context'
import { useFetchHook } from '@/hooks'
import { NOTICE_STATE_KEY, NoticeChannel } from '@/shared'
import { useSocketStore, useUserStore } from '.'

/** 公告弹窗状态，独立于存档持久化，避免被档案加载 / 切换槽位覆盖 */
interface NoticeState {
  /**
   * 弹窗展示基准时间
   * - 与公告列表的最新 updateTime 比较，决定是否应当弹窗
   */
  showTime: number
  /**
   * 公告阅读记录
   * id - 公告 id
   * time - 阅读记录时的公告时间戳，需要比对更新时间来判断公告阅读记录是否有效
   */
  read: [id: number, time: number][]
}

const NOTICE_STATE_DEFAULT: NoticeState = { showTime: 0, read: [] }

export const useNoticeStore = defineStore('global-notice', () => {
  const userStore = useUserStore()
  const socketStore = useSocketStore()

  // ==================== 公告弹窗状态 ====================
  /** 所有用户的公告状态，以 userId 为键 */
  const noticeStateMap = ref<Record<string, NoticeState>>({})
  try {
    const cached = JSON.parse(localStorage.getItem(NOTICE_STATE_KEY) ?? '{}') as Record<
      string,
      NoticeState
    > | null
    noticeStateMap.value = cached && typeof cached === 'object' ? cached : {}
  } catch {
    noticeStateMap.value = {}
  }

  /** 当前用户（未登录为 -1）的公告状态 */
  const stateKey = computed(() => String(userStore.auth.userId ?? -1))
  const noticeState = computed<NoticeState>(
    () => noticeStateMap.value[stateKey.value] ?? NOTICE_STATE_DEFAULT,
  )

  const updateNoticeState = (patch: Partial<NoticeState>) => {
    const key = stateKey.value
    noticeStateMap.value = {
      ...noticeStateMap.value,
      [key]: { ...(noticeStateMap.value[key] ?? NOTICE_STATE_DEFAULT), ...patch },
    }
  }

  watch(
    noticeStateMap,
    () => {
      localStorage.setItem(NOTICE_STATE_KEY, JSON.stringify(noticeStateMap.value))
    },
    { deep: true },
  )

  const {
    data: noticeList,
    refresh,
    onSuccess,
    ...rest
  } = useFetchHook({
    shallow: true,
    initialValue: [],
    onRequest: async () => {
      const { data: { record = [] } = {} } = await Apis.notice.listNotice({
        data: {
          channels: [NoticeChannel.COMMON, NoticeChannel.DASHBOARD],
          sort: ['sortIndex-'],
          getValid: true,
          size: 100,
        },
      })
      return record
    },
    diff: (oldData, newData) => {
      return JSON.stringify(oldData) !== JSON.stringify(newData)
    },
  })

  const noticeIdMap = computed(() =>
    noticeList.value.reduce((map, notice) => {
      map.set(notice.id!, notice)
      return map
    }, new Map<number, NoticeVo>()),
  )

  const clear = () => {
    noticeContext.close()
    noticeList.value = []
  }

  // 作为 ws 推送挂掉时的 fallback，定时刷新公告
  const { resume, pause } = useTimeoutPoll(
    async () => {
      await refresh()
    },
    20 * 60 * 1000,
    { immediate: false },
  )

  const readArchive = computed(() =>
    noticeState.value.read.reduce((record, [id, time]) => {
      record.set(id, time)
      return record
    }, new Map<number, number>()),
  )

  const isRead = computed(() => (id: number) => {
    const notice = noticeIdMap.value.get(id)
    if (!notice) return false

    const readTime = readArchive.value.get(id)
    if (readTime === undefined) return false

    return readTime >= Number(notice.updateTime)
  })

  /** 未被阅读过的新公告数量 */
  const newCount = computed(() =>
    noticeList.value.reduce((sum, notice) => {
      const readTime = readArchive.value.get(notice.id!)
      if (readTime === undefined || readTime < Number(notice.updateTime)) sum++
      return sum
    }, 0),
  )

  const read = (id: number) => {
    const notice = noticeIdMap.value.get(id)
    if (!notice) return

    if (isRead.value(id)) return

    const readMap = new Map(readArchive.value)
    readMap.set(id, Number(notice.updateTime))

    updateNoticeState({ read: [...readMap.entries()] })
  }

  const selected = shallowRef<NoticeVo>()

  onSuccess(async list => {
    const [first] = list
    selected.value = first

    const maxUpdateTime = list.reduce((lastTime, notice) => {
      const updateTime = Number(notice.updateTime)
      return updateTime > lastTime ? updateTime : lastTime
    }, 0)

    if (noticeState.value.showTime >= maxUpdateTime) return

    updateNoticeState({ showTime: maxUpdateTime })
    noticeContext.show()
  })

  socketStore.appEvent.on('NoticeAdded', refresh)
  socketStore.appEvent.on('NoticeDeleted', refresh)
  socketStore.appEvent.on('NoticeUpdated', refresh)

  watch(
    () => userStore.info?.id,
    userId => {
      if (userId === undefined) {
        clear()
        pause()
        return
      }
      resume()
    },
    { immediate: true },
  )

  return {
    newCount,
    selected,
    noticeList,
    noticeIdMap,
    readArchive,
    isRead,
    read,
    clear,
    refresh,
    pause,
    resume,
    onSuccess,
    show: noticeContext.show,
    close: noticeContext.close,
    ...rest,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNoticeStore, import.meta.hot))
}
