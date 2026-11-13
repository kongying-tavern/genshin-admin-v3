import { useFetchHook } from '@/hooks'

export interface ManagerOptions<C, T> {
  /** 是否启用定时更新 */
  timeoutPull?: {
    /** 更新间隔, 单位毫秒 */
    time: number
    /** 当条件满足时会开始定时更新，条件不满足时会暂停定时更新 */
    condition: () => boolean
  }
  /** 自定义上下文 */
  context: C
  /** 初始化上下文 */
  init?: (context: C) => Promise<void> | void
  /** 差异更新数据 */
  diff?: (context: C) => Promise<T>
  /** 全量更新数据 */
  full: (context: C) => Promise<T>
  /** 写入数据 */
  commit: (data: Awaited<T> | void, context: C) => Promise<void> | void
  /**
   * 用于同步本地状态
   * @param data 要同步的数据，通常是 diff 或 full 返回的数据
   * @param context 上下文
   * @param isInit 是否为 init 阶段（true: 完全替换; false: 增量更新）
   */
  syncState?: (data: T | void, context: C, isInit: boolean) => Promise<void> | void
}

export interface ManagerUpdateOptions {
  isFull?: boolean
}

export const useManager = <C, T>(options: ManagerOptions<C, T>) => {
  const { timeoutPull, context, init, diff, full, commit, syncState } = options

  const errorMessage = ref('')

  const initFlag = ref(false)

  const {
    refresh: update,
    loading,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async (options: ManagerUpdateOptions = {}) => {
      errorMessage.value = ''
      const { isFull = false } = options
      const isInit = !initFlag.value
      const data = await (async () => {
        // 首次更新只需要拉一次冷数据，diff / full 的结果由下面的统一分支产出，
        // 在这里额外跑一次 diff 会把整批点位查询白白发两遍
        if (!initFlag.value) {
          await init?.(context)
          initFlag.value = true
        }
        return (isFull ? full : (diff ?? full))(context)
      })()
      await syncState?.(data, context, isInit)
      await commit(data, context)
    },
  })

  onError(err => {
    errorMessage.value = err.message
  })

  /** 下一次更新的时间 */
  const nextUpdateTime = ref<number>(Date.now())

  const pollTime = ref(0)

  const { isActive, pause, resume } = useTimeoutPoll(
    async () => {
      if (!loading.value) await update()
      nextUpdateTime.value = Date.now() + pollTime.value
    },
    pollTime,
    {
      immediate: false,
    },
  )

  if (timeoutPull) {
    const { condition, time } = timeoutPull
    pollTime.value = time
    watch(
      () => condition(),
      isTrue => {
        if (!isTrue) {
          pause()
          return
        }
        resume()
      },
      { immediate: true },
    )
  }

  return {
    error: errorMessage,
    context,
    update,
    onError,
    loading,
    nextUpdateTime,
    isActive,
    ...rest,
  }
}
