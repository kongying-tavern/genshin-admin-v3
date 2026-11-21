import type { UserArchiveBody } from 'types/database'
import type { ArchiveData, StoredProgress } from './archiveSlots'
import type { UserPreference } from './types'
import { acceptHMRUpdate, defineStore } from 'pinia'
import db from '@/database'
import { useUserStore } from '@/stores'
import { Logger, messageFrom, sleep } from '@/utils'
import {
  emptySlots,
  mergePreference,
  readArchive,
  readArchiveSlots,
  readProgress,
  SETTINGS_SLOT,
  settingsBody,
  SLOT_COUNT,
  storeProgress,
} from './archiveSlots'
import { getDefaultPreference } from './types'

export type { ArchiveBody, ArchiveData, ArchiveSlotData } from './archiveSlots'
export { SETTINGS_SLOT } from './archiveSlots'

const SYNC_DEBOUNCE_DELAY = 300
const SYNC_RETRY_DELAY = 2000
const SYNC_RETRY_LIMIT = 3
const LOCAL_SLOT = -1

const emptyArchive = (id: number): ArchiveData => ({
  id,
  slotIndex: LOCAL_SLOT,
  body: readProgress(),
  timestamp: 0,
})

/** 账号设置与当前点位进度各自记录已同步的快照。所有读写按账号串行。 */
const newSession = (id: number) => ({
  id,
  ready: false,
  queue: Promise.resolve(),
  fetching: undefined as Promise<void> | undefined,
  syncedProgress: '',
  syncedPreference: '',
})
type Session = ReturnType<typeof newSession>

export const useArchiveStore = defineStore('global-archive', () => {
  const userStore = useUserStore()
  const logger = new Logger('存档同步')
  const accountId = () => (userStore.validateToken() ? (userStore.auth.userId ?? -1) : -1)
  let session = newSession(accountId())
  const currentArchive = ref<ArchiveData>(emptyArchive(session.id))
  const preference = ref<Partial<UserPreference>>(getDefaultPreference())
  const archiveSlots = shallowRef(emptySlots())
  const fetchLoading = ref(false)
  const fetchError = ref('')

  const progressJSON = () => JSON.stringify(storeProgress(currentArchive.value.body))
  const preferenceJSON = () => JSON.stringify(preference.value)
  const isDirty = (s: Session) =>
    progressJSON() !== s.syncedProgress || preferenceJSON() !== s.syncedPreference
  session.syncedProgress = progressJSON()
  session.syncedPreference = preferenceJSON()

  const hash = asyncComputed(async () => {
    const res = [...currentArchive.value.body.Data_KYJG.values()].join('')
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(res))
    return [...new Uint8Array(digest)]
      .map(num => num.toString(16).padStart(2, '0').toUpperCase())
      .join('')
  }, '')

  const assertCurrent = (s: Session) => {
    if (s !== session || accountId() !== s.id) throw new Error('存档账号已切换')
  }

  const enqueue = <T>(s: Session, action: () => Promise<T>) => {
    const task = s.queue.then(() => {
      assertCurrent(s)
      return action()
    })
    s.queue = task.then(
      () => {},
      () => {},
    )
    return task
  }

  const activate = (s: Session, archive: ArchiveData) => {
    const progress = storeProgress(archive.body)
    currentArchive.value = { ...archive, body: readProgress(progress) }
    s.syncedProgress = JSON.stringify(progress)
  }

  const setPreference = (s: Session, value: Partial<UserPreference>) => {
    preference.value = value
    s.syncedPreference = preferenceJSON()
  }

  const acceptCloudPreference = (
    s: Session,
    cloud: Partial<UserPreference>,
    baseline = s.syncedPreference,
  ) => {
    const merged = mergePreference(cloud, baseline, preference.value)
    if (JSON.stringify(merged) !== preferenceJSON()) preference.value = merged
    s.syncedPreference = JSON.stringify(cloud)
  }

  const localSnapshot = (): UserArchiveBody => {
    const { id, slotIndex, timestamp, body } = currentArchive.value
    const progress = storeProgress(body)
    const settings = preferenceJSON()
    const pending = {
      progress: slotIndex !== LOCAL_SLOT && JSON.stringify(progress) !== session.syncedProgress,
      preference: id !== -1 && settings !== session.syncedPreference,
    }
    return {
      id,
      slotIndex,
      timestamp,
      body: progress,
      preference: JSON.parse(settings),
      pending: pending.progress || pending.preference ? pending : undefined,
    }
  }

  const saveRemote = async (s: Session, slotIndex: number, data: string) => {
    for (let attempt = 1; ; attempt++) {
      assertCurrent(s)
      try {
        await Apis.archive.saveArchive({
          pathParams: { slot_index: slotIndex },
          data,
          shareRequest: false,
        })
        assertCurrent(s)
        return
      } catch (err) {
        assertCurrent(s)
        if (attempt >= SYNC_RETRY_LIMIT) throw err
        await sleep(SYNC_RETRY_DELAY * attempt)
      }
    }
  }

  const readRemote = async (s: Session) => {
    const { data } = await Apis.archive.getAllHistoryArchive({ shareRequest: false })
    assertCurrent(s)
    if (!Array.isArray(data)) throw new Error('云存档列表读取失败')
    return readArchiveSlots(data, s.id)
  }

  const latestProgress = (slots: ReturnType<typeof emptySlots>) =>
    Object.values(slots)
      .map(slot => slot?.latest)
      .filter((archive): archive is ArchiveData => Boolean(archive))
      .sort((a, b) => b.timestamp - a.timestamp)[0]

  /** 仅在成功读取槽位列表后补建 1 号槽位。创建响应丢失或并发创建时，以回读为准。 */
  const fetchSlots = async (s: Session) => {
    let remote = await readRemote(s)
    const migrationPreference = s.ready
      ? preference.value
      : (remote.legacyPreference ?? preference.value)
    if (!remote.slots[SETTINGS_SLOT]) {
      const local = currentArchive.value
      const initial =
        local.slotIndex === SETTINGS_SLOT || !latestProgress(remote.slots)
          ? local
          : emptyArchive(s.id)
      const data = settingsBody(storeProgress(initial.body), migrationPreference, initial.timestamp)
      let creationError: unknown
      try {
        await Apis.archive.createSlotAndSaveArchive({
          pathParams: { slot_index: SETTINGS_SLOT, name: '默认存档' },
          data,
          shareRequest: false,
        })
      } catch (err) {
        creationError = err
      }
      assertCurrent(s)
      remote = await readRemote(s)
      if (!remote.slots[SETTINGS_SLOT]) throw creationError ?? new Error('未能创建 1 号槽位')
    }

    const primary = remote.slots[SETTINGS_SLOT]!
    if (!remote.preference) {
      // 老槽位可能只有点位，或在旧客户端中已回退到空。只迁移一次设置。
      const latest = primary.latest ?? { ...emptyArchive(s.id), slotIndex: SETTINGS_SLOT }
      remote.preference = JSON.parse(JSON.stringify(migrationPreference)) as Partial<UserPreference>
      await saveRemote(
        s,
        SETTINGS_SLOT,
        settingsBody(storeProgress(latest.body), remote.preference, latest.timestamp),
      )
      primary.latest = latest
    }
    assertCurrent(s)
    archiveSlots.value = remote.slots
    const previousSettings = preferenceJSON()
    acceptCloudPreference(s, remote.preference)

    if (!s.ready) {
      const previousSlot = remote.slots[currentArchive.value.slotIndex]?.latest
      if (progressJSON() === s.syncedProgress) {
        const active = previousSlot ?? latestProgress(remote.slots)
        if (active) activate(s, active)
      } else if (!previousSlot) {
        // 原槽位已在其他设备删除，保留本地待保存进度。
        currentArchive.value.slotIndex = LOCAL_SLOT
      }
    }
    if (!s.ready || previousSettings !== preferenceJSON()) await db.userArchive.put(localSnapshot())
    assertCurrent(s)
    s.ready = true
    if (isDirty(s)) scheduleSync()
  }

  const fetchArchive = () => {
    const s = session
    if (s.id === -1) return Promise.resolve()
    if (s.fetching) return s.fetching
    fetchLoading.value = true
    fetchError.value = ''
    s.fetching = enqueue(s, () => fetchSlots(s))
      .catch(err => {
        if (s === session) {
          fetchError.value = messageFrom(err)
          logger.error(`读取云存档失败：${fetchError.value}`)
        }
        throw err
      })
      .finally(() => {
        s.fetching = undefined
        if (s === session) fetchLoading.value = false
      })
    return s.fetching
  }

  const recordSave = (s: Session, slotIndex: number, progress: StoredProgress, time: number) => {
    const slot = archiveSlots.value[slotIndex]
    if (!slot) return
    const latest = { id: s.id, slotIndex, body: readProgress(progress), timestamp: time }
    archiveSlots.value = {
      ...archiveSlots.value,
      [slotIndex]: { ...slot, latest, updateTime: new Date().toISOString() },
    }
  }

  /** 1 号包含进度和设置。只改其中一项时，从云端取另一项再写回。 */
  const saveSettingsSlot = async (
    s: Session,
    changedProgress: StoredProgress | undefined,
    changedPreference: Partial<UserPreference> | undefined,
  ) => {
    assertCurrent(s)
    const { data } = await Apis.archive.getLastArchive({
      pathParams: { slot_index: SETTINGS_SLOT },
      shareRequest: false,
    })
    assertCurrent(s)
    if (!data?.archive) throw new Error('未能读取 1 号槽位的当前存档')
    const { archive: latest, preference: remotePreference } = readArchive(data, SETTINGS_SLOT, s.id)
    const remoteProgress = storeProgress(latest.body)
    const progress = changedProgress ?? remoteProgress
    const time =
      changedProgress && JSON.stringify(progress) !== JSON.stringify(remoteProgress)
        ? Date.now()
        : latest.timestamp
    const cloudSettings = remotePreference ?? preference.value
    const settings = changedPreference
      ? mergePreference(cloudSettings, s.syncedPreference, changedPreference)
      : cloudSettings
    await saveRemote(s, SETTINGS_SLOT, settingsBody(progress, settings, time))
    assertCurrent(s)
    recordSave(s, SETTINGS_SLOT, progress, time)
    if (
      !changedProgress
      && currentArchive.value.slotIndex === SETTINGS_SLOT
      && JSON.stringify(progress) !== s.syncedProgress
      && progressJSON() === s.syncedProgress
    )
      activate(s, latest)
    acceptCloudPreference(
      s,
      settings,
      changedPreference ? JSON.stringify(changedPreference) : s.syncedPreference,
    )
    return time
  }

  const syncChanges = async (s: Session, target?: number) => {
    const local = localSnapshot()
    const source = currentArchive.value.slotIndex
    const slot = target ?? source
    const progress = JSON.stringify(local.body)
    const settings = JSON.stringify(local.preference)
    const saveProgress = target !== undefined || progress !== s.syncedProgress
    const savePreference = settings !== s.syncedPreference
    if (!saveProgress && !savePreference) return

    await db.userArchive.put(local)
    assertCurrent(s)
    if (s.id === -1) {
      s.syncedProgress = progress
      s.syncedPreference = settings
      return
    }
    if (!s.ready) throw new Error('云存档尚未就绪')
    try {
      let progressError: unknown
      if (saveProgress && slot !== SETTINGS_SLOT) {
        try {
          if (slot !== LOCAL_SLOT) {
            await saveRemote(s, slot, progress)
            assertCurrent(s)
            const time = Date.now()
            recordSave(s, slot, local.body, time)
            if (slot === source) currentArchive.value.timestamp = time
          }
          if (slot === source) s.syncedProgress = progress
        } catch (err) {
          if (!savePreference) throw err
          // 普通槽位的保存失败时，仍尝试独立保存账号设置。
          progressError = err
        }
      }
      const primaryProgress = saveProgress && slot === SETTINGS_SLOT
      if (primaryProgress || savePreference) {
        const time = await saveSettingsSlot(
          s,
          primaryProgress ? local.body : undefined,
          savePreference ? local.preference : undefined,
        )
        assertCurrent(s)
        if (primaryProgress && slot === source) {
          s.syncedProgress = progress
          currentArchive.value.timestamp = time
        }
      }
      if (progressError) throw progressError
    } finally {
      // 两个槽位可能只有一个写入成功。下次登录只重试尚未确认的改动。
      if (
        s === session
        && (local.pending
          || settings !== preferenceJSON()
          || local.timestamp !== currentArchive.value.timestamp)
      )
        await db.userArchive.put(localSnapshot())
    }
  }

  let syncTimer: ReturnType<typeof setTimeout> | undefined
  const cancelTimer = () => clearTimeout(syncTimer)
  const scheduleSync = (delay = SYNC_DEBOUNCE_DELAY) => {
    cancelTimer()
    syncTimer = setTimeout(() => {
      void flush().catch(() => {})
    }, delay)
  }

  const sync = async (target?: number) => {
    const s = session
    cancelTimer()
    try {
      if (s.id !== -1 && !s.ready) {
        if (target === undefined && !isDirty(s)) return s.queue
        await db.userArchive.put(localSnapshot())
        assertCurrent(s)
        await fetchArchive()
      }
      await enqueue(s, () => syncChanges(s, target))
      if (s === session && target !== undefined && progressJSON() !== s.syncedProgress)
        scheduleSync()
    } catch (err) {
      if (s === session) {
        logger.error(`存档同步失败：${messageFrom(err)}`)
        scheduleSync(SYNC_RETRY_DELAY)
      }
      throw err
    }
  }
  const flush = () => sync()

  const saveArchiveToSlot = (slotIndex = currentArchive.value.slotIndex) => {
    if (
      slotIndex !== LOCAL_SLOT
      && (!Number.isInteger(slotIndex) || slotIndex < SETTINGS_SLOT || slotIndex > SLOT_COUNT)
    )
      throw new Error(`无效的存档槽位 ${slotIndex}`)
    return sync(slotIndex)
  }

  /** 切换前排空原槽位的待写进度。异步保存期间产生的新标记也属于原槽位。 */
  const selectArchive = (select: () => ArchiveData | undefined) => {
    const s = session
    return enqueue(s, async () => {
      do {
        await syncChanges(s)
        assertCurrent(s)
      } while (progressJSON() !== s.syncedProgress)
      const archive = select()
      if (!archive) throw new Error('没有可读取的存档')
      activate(s, archive)
      await db.userArchive.put(localSnapshot())
    })
  }

  const loadArchiveSlot = (slotIndex = LOCAL_SLOT) =>
    slotIndex < 0 ? Promise.resolve() : selectArchive(() => archiveSlots.value[slotIndex]?.latest)

  const loadHistoryArchive = async (slotIndex: number, timestamp: number) => {
    if (slotIndex === SETTINGS_SLOT) throw new Error('1 号槽位只提供当前存档')
    return selectArchive(() =>
      archiveSlots.value[slotIndex]?.archiveList.find(entry => entry.timestamp === timestamp),
    )
  }

  const loadLatestArchive = () =>
    latestProgress(archiveSlots.value)
      ? selectArchive(() => latestProgress(archiveSlots.value))
      : Promise.resolve()

  const createArchiveSlot = async (name: string, slotIndex: number, saveCurrent = true) => {
    if (!Number.isInteger(slotIndex) || slotIndex <= SETTINGS_SLOT || slotIndex > SLOT_COUNT)
      throw new Error(`不能手动创建槽位 ${slotIndex}`)
    const s = session
    return enqueue(s, async () => {
      if (!s.ready || s.id === -1) throw new Error('云存档尚未就绪')
      const body = saveCurrent ? currentArchive.value.body : readProgress()
      await Apis.archive.createSlotAndSaveArchive({
        pathParams: { slot_index: slotIndex, name },
        data: JSON.stringify(storeProgress(body)),
        shareRequest: false,
      })
    })
  }

  const deleteArchiveSlot = async (slotIndex = LOCAL_SLOT) => {
    if (slotIndex === SETTINGS_SLOT) throw new Error('1 号槽位不可删除')
    if (slotIndex < 0 || session.id === -1) return
    const s = session
    await enqueue(s, async () => {
      await Apis.archive.removeArchive({
        pathParams: { slot_index: slotIndex },
        shareRequest: false,
      })
      assertCurrent(s)
      if (currentArchive.value.slotIndex === slotIndex) {
        currentArchive.value.slotIndex = LOCAL_SLOT
        await db.userArchive.put(localSnapshot())
      }
    })
    await fetchArchive()
  }

  const openAccount = async (id: number) => {
    cancelTimer()
    if (session.id !== id && isDirty(session)) {
      // 登录态已经改变，原账号的未确认修改留在自己的缓存，等下次登录继续同步。
      void db.userArchive.put(localSnapshot()).catch(err => logger.error(messageFrom(err)))
    }
    const s = newSession(id)
    session = s
    archiveSlots.value = emptySlots()
    fetchError.value = ''
    fetchLoading.value = id !== -1
    activate(s, emptyArchive(id))
    setPreference(s, getDefaultPreference())
    await enqueue(s, async () => {
      const local = await db.userArchive.get(id)
      assertCurrent(s)
      if (!local) return
      activate(s, {
        id,
        slotIndex: local.slotIndex ?? LOCAL_SLOT,
        timestamp: local.timestamp,
        body: readProgress(local.body),
      })
      setPreference(s, local.preference ?? local.body.Preference ?? preference.value)
      if (local.pending?.progress) s.syncedProgress = ''
      if (local.pending?.preference) s.syncedPreference = ''
    }).catch(err => {
      if (s === session) throw err
    })
    if (s === session && id !== -1) {
      // 云端请求在后台完成，首屏可以先使用这个账号的本地缓存。
      void fetchArchive().catch(() => {})
    }
  }

  const init = async () => {
    watch(
      accountId,
      id => {
        void openAccount(id).catch(err => logger.error(messageFrom(err)))
      },
      { flush: 'sync' },
    )
    await openAccount(accountId())
    watch([() => currentArchive.value.body, preference], () => scheduleSync(), { deep: true })
    const flushOnLeave = () => {
      void flush().catch(() => {})
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushOnLeave()
    })
    window.addEventListener('pagehide', flushOnLeave)
    window.addEventListener('online', () => {
      void fetchArchive()
        .then(flush)
        .catch(() => {})
    })
  }

  return {
    currentArchive,
    preference,
    hash,
    fetchLoading,
    fetchError,
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
