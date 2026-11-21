import type { UserPreference } from '@/stores/types'

/** 用户存档的本地数据结构 */
interface UserArchiveBody {
  /** 存档的用户 id */
  id: number
  /** 当前设备上次激活的进度槽位，旧缓存没有此字段 */
  slotIndex?: number
  preference?: Partial<UserPreference>
  /** 上次写入本地后，尚未得到云端确认的内容 */
  pending?: { progress: boolean; preference: boolean }
  body: {
    Data_KYJG: number[]
    Time_KYJG: Record<number, string>
    /** 旧版缓存与点位进度一起保存的设置 */
    Preference?: Partial<UserPreference>
  }
  timestamp: number
}

interface ScoreGeneratedCache {
  /**
   * 遵循如下格式
   * ```
   * ${Timestamp}-${TimeStamp}
   * ```
   */
  id: string
}

type Hash<T> = T & {
  __hash?: string
}
