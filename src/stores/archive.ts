import type { SysArchiveSlotVo, SysArchiveVo } from '@/api/alova/globals'
import type { UserPreference } from '@/stores/types/userPreference'
import { acceptHMRUpdate, defineStore } from 'pinia'
import db from '@/database'
import { useFetchHook } from '@/hooks'
import { useUserStore } from '@/stores'
import { Logger, messageFrom, sleep } from '@/utils'
import { getDefaultPreference } from './types'

export interface ArchiveBody {
  /** 点位存档 */
  Data_KYJG: Set<number>
  /**
   * 刷新时间存档
   * @format `YYYY/MM/DD HH:mm:ss`
   */
  Time_KYJG: Record<number, string>
  /** 用户首选项 */
  Preference: Partial<UserPreference>
}

export interface ArchiveData {
  id: number
  slotIndex: number
  body: ArchiveBody
  timestamp: number
  historyIndex?: number
}

export interface ArchiveSlotData extends SysArchiveSlotVo {
  archiveList: ArchiveData[]
  timestamp: number
}

/** 自动同步的去抖间隔（ms） */
const SYNC_DEBOUNCE_DELAY = 300
/** 同步失败后的重试间隔（ms），实际间隔会随尝试次数递增 */
const SYNC_RETRY_DELAY = 2000
/** 单次同步的最大尝试次数 */
const SYNC_RETRY_LIMIT = 3

const parserArchive = (
  { archive = '', time = '', historyIndex }: SysArchiveVo,
  options: { slotIndex: number; userId: number },
): ArchiveData => {
  const {
    Data_KYJG: datas = [],
    Time_KYJG: times = {},
    Preference: preference = {},
  } = JSON.parse(archive) as {
    Data_KYJG?: (string | number)[]
    Time_KYJG?: Record<number, string>
    Preference?: Partial<UserPreference>
  }
  return {
    id: options.userId,
    slotIndex: options.slotIndex,
    historyIndex,
    body: {
      Data_KYJG: new Set(datas.map(Number)),
      Time_KYJG: times,
      Preference: preference,
    },
    timestamp: new Date(time).getTime(),
  }
}

const initArchiveList = (): Record<number, ArchiveSlotData | undefined> =>
  Object.fromEntries(Array.from({ length: 5 }).map((_, index) => [index + 1, undefined]))

const initArchive = (): ArchiveData => ({
  id: -1,
  slotIndex: -1,
  body: {
    Data_KYJG: new Set(),
    Time_KYJG: {},
    Preference: getDefaultPreference(),
  },
  timestamp: new Date().getTime(),
})

/** 存档管理 */
export const useArchiveStore = defineStore('global-archive', () => {
  const userStore = useUserStore()
  const logger = new Logger('存档同步')

  const currentArchive = ref<ArchiveData>(initArchive())

  /** 点位存档 hash，用于触发地图点位重绘 */
  const hash = asyncComputed(async () => {
    const res = [...currentArchive.value.body.Data_KYJG.values()].join('')
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(res))
    return [...new Uint8Array(digest)]
      .map(num => num.toString(16).padStart(2, '0').toUpperCase())
      .join('')
  }, '')

  const getJSONArchive = () =>
    JSON.stringify({
      Data_KYJG: [...currentArchive.value.body.Data_KYJG],
      Time_KYJG: currentArchive.value.body.Time_KYJG,
      Preference: currentArchive.value.body.Preference,
    })

  // ==================== 同步队列 ====================
  /** 最近一次成功同步（本地 + 远程）的存档内容快照，用于跳过无变化的同步 */
  let syncedSnapshot = getJSONArchive()
  /** 自动同步的去抖定时器 */
  let syncTimer: ReturnType<typeof setTimeout> | undefined
  /** 串行同步链，保证同一时刻只有一个同步任务执行，避免远端写入乱序 */
  let syncQueue: Promise<void> = Promise.resolve()

  /** 捕获当前存档内容快照 */
  const captureSnapshot = () => ({
    json: getJSONArchive(),
    timestamp: currentArchive.value.timestamp,
  })

  /** 将存档写入本地数据库 */
  const persistLocalArchive = async (json: string, timestamp: number) => {
    await db.userArchive.put({
      // 未登录时存入 id 为 -1 的本地用户存档
      id: userStore.validateToken() ? userStore.auth.userId! : -1,
      body: JSON.parse(json),
      timestamp,
    })
  }

  /** 带重试地写入远程槽位 */
  const saveRemoteArchive = async (slotIndex: number, json: string) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await Apis.archive.saveArchive({
          pathParams: { slot_index: slotIndex },
          data: json,
        })
        return
      } catch (err) {
        if (attempt >= SYNC_RETRY_LIMIT) throw err
        await sleep(SYNC_RETRY_DELAY * attempt)
      }
    }
  }

  /**
   * 执行一次同步
   * @param force 忽略「内容未变化」的跳过判断，强制执行写入
   * @param slotIndex 远程目标槽位
   * @returns 是否同步成功，失败时保留脏数据以便重试
   */
  const performSync = async (force: boolean, slotIndex: number) => {
    const { json, timestamp } = captureSnapshot()
    // 内容未变化且非强制时跳过，避免重复写入
    if (!force && json === syncedSnapshot) return true
    try {
      await persistLocalArchive(json, timestamp)
      // 仅登录且目标为有效远程槽位时才写入远程
      if (slotIndex > 0 && slotIndex <= 5 && userStore.validateToken())
        await saveRemoteArchive(slotIndex, json)
      // 仅当同步期间内容未再变化时，才将该快照标记为已同步，避免覆盖加载后的新快照
      if (captureSnapshot().json === json) syncedSnapshot = json
      return true
    } catch (err) {
      logger.error(`槽位 ${slotIndex} 同步失败：${messageFrom(err)}`)
      return false
    }
  }

  /** 将同步任务排入串行队列，保证同步顺序执行，失败时自动重试 */
  const enqueueSync = (force: boolean, slotIndex?: number) => {
    if (syncTimer !== undefined) {
      clearTimeout(syncTimer)
      syncTimer = undefined
    }
    const target = slotIndex ?? currentArchive.value.slotIndex
    const task = syncQueue.then(async () => {
      const synced = await performSync(force, target)
      // 同步失败时保留脏数据，稍后自动重试
      if (!synced) {
        syncTimer = setTimeout(() => {
          syncTimer = undefined
          enqueueSync(false)
        }, SYNC_RETRY_DELAY)
      }
    })
    syncQueue = task.catch(() => {})
    return task
  }

  /** 延迟执行自动同步（去抖合并连续变更） */
  const scheduleSync = (delay = SYNC_DEBOUNCE_DELAY) => {
    if (syncTimer !== undefined) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      syncTimer = undefined
      enqueueSync(false)
    }, delay)
  }

  /** 立即执行一次同步（跳过去抖等待） */
  const flush = () => enqueueSync(false)

  const setArchive = (archiveData: ArchiveData) => {
    currentArchive.value = archiveData
    // 将加载的存档视为已同步，避免 watcher 将其回写
    syncedSnapshot = getJSONArchive()
  }

  const {
    data: archiveSlots,
    loading: fetchLoading,
    refresh: fetchArchive,
  } = useFetchHook({
    onRequest: async () => {
      const slots = initArchiveList()
      if (!userStore.validateToken()) return slots
      const { data = [] } = await Apis.archive.getAllHistoryArchive({})
      data.forEach(
        ({ archive: historyArchives = [], slotIndex = -1, updateTime, ...rest } = {}) => {
          const archive: ArchiveSlotData = {
            ...rest,
            updateTime,
            slotIndex,
            timestamp: (updateTime ? new Date(updateTime) : new Date()).getTime(),
            archiveList: historyArchives
              .map(body => parserArchive(body, { slotIndex, userId: userStore.auth.userId! }))
              .sort(({ timestamp: a }, { timestamp: b }) => b - a),
          }
          slots[slotIndex] = archive
        },
      )
      return slots
    },
  })

  /** 加载指定槽位的最新存档 */
  const loadArchiveSlot = (slotIndex = -1) => {
    if (slotIndex < 0) return
    const archiveSlot = archiveSlots.value[slotIndex]
    if (!archiveSlot) throw new Error(`槽位 ${slotIndex} 没有存档`)
    const latestArchive = archiveSlot.archiveList[0]
    if (!latestArchive) throw new Error(`槽位 ${slotIndex} 没有存档历史`)
    setArchive(latestArchive)
  }

  /**
   * 创建新的存档槽位
   * - `saveCurrent` 同时保存当前应用状态为存档
   */
  const createArchiveSlot = async (name: string, slotIndex: number, saveCurrent = true) => {
    if (slotIndex < 0 || slotIndex >= 5) throw new Error(`无效的存档槽位 ${slotIndex}`)
    const data = saveCurrent
      ? getJSONArchive()
      : JSON.stringify({ Data_KYJG: [], Time_KYJG: {}, Preference: {} })
    await Apis.archive.createSlotAndSaveArchive({
      pathParams: {
        slot_index: slotIndex,
        name,
      },
      data,
    })
  }

  /**
   * 将当前存档写入指定槽位（强制写入，用于「保存到存档」等显式操作）
   * @param slotIndex 目标槽位，默认取当前存档槽位
   */
  const saveArchiveToSlot = (slotIndex = -1) => enqueueSync(true, slotIndex)

  /** 删除指定槽位的存档 */
  const deleteArchiveSlot = async (slotIndex = -1) => {
    if (slotIndex < 0 || !userStore.validateToken()) return
    if (slotIndex === currentArchive.value.slotIndex) currentArchive.value.slotIndex = -1
    await Apis.archive.removeArchive({
      pathParams: { slot_index: slotIndex },
    })
    await fetchArchive()
  }

  /** 加载指定槽位的历史存档 */
  const loadHistoryArchive = (slotIndex: number, timestamp: number) => {
    if (slotIndex < 0) return
    const archiveSlot = archiveSlots.value[slotIndex]
    if (!archiveSlot) throw new Error(`槽位 ${slotIndex} 没有存档`)
    const historyArchive = archiveSlot.archiveList.find(history => history.timestamp === timestamp)
    if (!historyArchive)
      throw new Error(`时间为 ${new Date(timestamp).toLocaleString()} 的存档历史为空`)
    setArchive(historyArchive)
  }

  /** 加载最新槽位的最新存档 */
  const loadLatestArchive = async () => {
    let latestArchive: ArchiveSlotData | undefined

    for (const slotIndex in archiveSlots.value) {
      const slotArchive = archiveSlots.value[slotIndex]
      if (!slotArchive) continue
      if (!latestArchive || slotArchive.timestamp > latestArchive.timestamp)
        latestArchive = slotArchive
    }

    const { userId } = userStore.auth
    if (userId === undefined) return

    // 如果没有存档，则读取用户的本地数据库存档。
    if (!latestArchive) {
      const localArchive = await db.userArchive.get(userId)
      if (!localArchive) return
      const { id, body, timestamp } = localArchive
      setArchive({
        id,
        slotIndex: -1,
        body: {
          Data_KYJG: new Set(body.Data_KYJG),
          Time_KYJG: body.Time_KYJG,
          Preference: body.Preference ?? getDefaultPreference(),
        },
        timestamp,
      })
      return
    }

    if (!latestArchive) return

    loadArchiveSlot(latestArchive.slotIndex)
  }

  const init = async () => {
    const localArchive = await db.userArchive.get(-1)
    // 读取未登录存档
    if (localArchive) {
      const { id, body, timestamp } = localArchive
      setArchive({
        id,
        slotIndex: -1,
        body: {
          Data_KYJG: new Set(body.Data_KYJG),
          Time_KYJG: body.Time_KYJG,
          Preference: body.Preference ?? getDefaultPreference(),
        },
        timestamp,
      })
    }
    watch(
      () => userStore.auth.userId,
      async () => {
        await fetchArchive()
        await loadLatestArchive()
      },
      { immediate: true },
    )
    // 监听存档内容变化并去抖同步；仅监听 body，避免 slotIndex / timestamp 造成无意义同步
    watch(
      () => currentArchive.value.body,
      () => scheduleSync(),
      { deep: true, immediate: true },
    )
    // 页面隐藏 / 关闭前尽力同步一次，避免去抖窗口内的变更丢失
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
    window.addEventListener('pagehide', () => flush())
  }

  return {
    currentArchive,
    hash,
    fetchLoading,
    archiveSlots,

    fetchArchive,
    createArchiveSlot,
    saveArchiveToSlot,
    deleteArchiveSlot,
    loadArchiveSlot,
    loadHistoryArchive,
    loadLatestArchive,
    flush,
    init,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useArchiveStore, import.meta.hot))
}
