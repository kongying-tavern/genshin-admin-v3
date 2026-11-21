import type { SysArchiveSlotVo, SysArchiveVo } from '@/api/alova/globals'
import type { UserPreference } from './types'
import { isEqual } from 'lodash'

export const SETTINGS_SLOT = 1
export const SLOT_COUNT = 5

export interface ArchiveBody {
  Data_KYJG: Set<number>
  /** 点位刷新时间，格式为 YYYY/MM/DD HH:mm:ss */
  Time_KYJG: Record<number, string>
}

export interface ArchiveData {
  id: number
  slotIndex: number
  body: ArchiveBody
  timestamp: number
  historyIndex?: number
}

export interface ArchiveSlotData extends Omit<SysArchiveSlotVo, 'archive' | 'slotIndex'> {
  slotIndex: number
  latest?: ArchiveData
  archiveList: ArchiveData[]
}

export interface StoredProgress {
  Data_KYJG: number[]
  Time_KYJG: Record<number, string>
}

interface StoredArchive {
  Data_KYJG?: (number | string)[]
  Time_KYJG?: Record<number, string>
  Preference?: Partial<UserPreference>
  /** 1 号槽位最后保存点位进度的时间，单独写设置时沿用此值 */
  ProgressTime?: number
}

export const emptySlots = (): Record<number, ArchiveSlotData | undefined> =>
  Object.fromEntries(Array.from({ length: SLOT_COUNT }, (_, index) => [index + 1, undefined]))

export const readProgress = (data: StoredArchive = {}): ArchiveBody => ({
  Data_KYJG: new Set(data.Data_KYJG?.map(Number)),
  Time_KYJG: { ...data.Time_KYJG },
})

export const storeProgress = (body: ArchiveBody): StoredProgress => ({
  Data_KYJG: [...body.Data_KYJG],
  Time_KYJG: { ...body.Time_KYJG },
})

export const settingsBody = (
  progress: StoredProgress,
  preference: Partial<UserPreference>,
  progressTime: number,
) => JSON.stringify({ ...progress, Preference: preference, ProgressTime: progressTime })

/** 将本地改过的设置项应用到最新云端值，保留其他设备同期修改的独立设置项。 */
export function mergePreference(
  cloud: Partial<UserPreference>,
  baseline: string,
  local: Partial<UserPreference>,
): Partial<UserPreference> {
  if (!baseline) return local
  const previous: Partial<UserPreference> = JSON.parse(baseline)
  const merged: Record<string, unknown> = { ...cloud }
  for (const key of Object.keys({ ...previous, ...local }) as (keyof UserPreference)[]) {
    if (isEqual(previous[key], local[key])) continue
    if (local[key] === undefined) delete merged[key]
    else merged[key] = local[key]
  }
  return merged
}

const timestamp = (time?: string | number) =>
  Number.isFinite(Number(time)) ? Number(time) : new Date(time ?? 0).getTime() || 0

export function readArchive(
  entry: SysArchiveVo,
  slotIndex: number,
  userId: number,
  slotTime?: string,
) {
  const data: StoredArchive = JSON.parse(entry.archive ?? '')
  const time = timestamp(entry.time) || timestamp(slotTime)
  const archive: ArchiveData = {
    id: userId,
    slotIndex,
    timestamp: slotIndex === SETTINGS_SLOT ? (data.ProgressTime ?? time) : time,
    historyIndex: entry.historyIndex,
    body: readProgress(data),
  }
  return { archive, preference: data.Preference }
}

export function readArchiveSlots(rows: SysArchiveSlotVo[], userId: number) {
  const slots = emptySlots()
  let preference: Partial<UserPreference> | undefined
  let legacy: { timestamp: number; preference: Partial<UserPreference> } | undefined

  for (const { archive = [], slotIndex, ...metadata } of rows) {
    if (slotIndex === undefined) continue
    const ordered = [...archive].sort((a, b) => timestamp(b.time) - timestamp(a.time))
    const isSettingsSlot = slotIndex === SETTINGS_SLOT
    const entries = (isSettingsSlot ? ordered.slice(0, 1) : ordered).map(entry => {
      const record = readArchive(entry, slotIndex, userId, metadata.updateTime)
      if (record.preference) {
        if (isSettingsSlot) preference = record.preference
        else if (!legacy || record.archive.timestamp > legacy.timestamp)
          legacy = { timestamp: record.archive.timestamp, preference: record.preference }
      }
      return record.archive
    })
    slots[slotIndex] = {
      ...metadata,
      slotIndex,
      latest: entries[0],
      archiveList: isSettingsSlot ? [] : entries,
    }
  }
  return { slots, preference, legacyPreference: legacy?.preference }
}
