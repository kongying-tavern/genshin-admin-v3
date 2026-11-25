import type { UserArchiveBody } from 'types/database'
import type { SysArchiveSlotVo, SysArchiveVo } from '@/api/alova/globals'
import type { UserPreference } from '@/stores/types'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { useArchiveStore } from '@/stores/archive'
import { usePreferenceStore } from '@/stores/userPreference'

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  sleep: vi.fn(),
  error: vi.fn(),
}))
let auth: { userId?: number }
vi.mock('@/database', () => ({ default: { userArchive: { put: mocks.put, get: mocks.get } } }))
vi.mock('@/stores', () => ({
  useUserStore: () => {
    const account = auth
    return { auth: account, validateToken: () => account.userId !== undefined }
  },
}))
vi.mock('@/utils', () => ({
  Logger: class {
    error = mocks.error
  },
  messageFrom: String,
  sleep: mocks.sleep,
}))

type Save = { pathParams: { slot_index: number }; data: string }
const api = {
  getAllHistoryArchive: vi.fn<() => Promise<{ data: SysArchiveSlotVo[] }>>(),
  getLastArchive:
    vi.fn<(request: { pathParams: { slot_index: number } }) => Promise<{ data?: SysArchiveVo }>>(),
  createSlotAndSaveArchive:
    vi.fn<(request: Save & { pathParams: { name: string } }) => Promise<void>>(),
  saveArchive: vi.fn<(request: Save) => Promise<void>>(),
  removeArchive: vi.fn<(request: { pathParams: { slot_index: number } }) => Promise<void>>(),
}

const local = new Map<number, UserArchiveBody>()
const cloud = new Map<number, SysArchiveSlotVo>()
const listeners: { target: EventTarget; type: string; listener: EventListener }[] = []
const trackListeners = (target: EventTarget) => {
  const original = target.addEventListener.bind(target)
  vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
    listeners.push({ target, type, listener: listener as EventListener })
    original(type, listener as EventListener, options)
  })
}

const preference = (tab: string) => ({ 'settingPanel.state.activedKey': tab })
const entry = (time: number, ids: number[], settings?: Partial<UserPreference>): SysArchiveVo => ({
  time: new Date(time).toISOString(),
  archive: JSON.stringify({ Data_KYJG: ids, Time_KYJG: {}, Preference: settings }),
})
const seed = (index: number, ...entries: SysArchiveVo[]) => {
  cloud.set(index, {
    id: index,
    name: `存档 ${index}`,
    slotIndex: index,
    updateTime: entries[0]?.time,
    archive: entries.map((record, i) => ({ ...record, historyIndex: i + 1 })),
  })
}
const body = (slot: number) => JSON.parse(cloud.get(slot)!.archive![0].archive!)
const savedSlots = () =>
  api.saveArchive.mock.calls.map(([request]) => request.pathParams.slot_index)
const clearWrites = () => {
  mocks.put.mockClear()
  api.saveArchive.mockClear()
}
const start = async () => {
  const store = useArchiveStore()
  await store.init()
  await store.fetchArchive()
  await nextTick()
  await vi.advanceTimersByTimeAsync(300)
  clearWrites()
  return store
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  auth = reactive({ userId: 7 })
  cloud.clear()
  local.clear()
  vi.resetAllMocks()
  seed(1, entry(10, [11], preference('mapsetting')), entry(5, [10], preference('old')))
  seed(2, entry(30, [22], preference('database')), entry(20, [21], preference('network')))
  seed(3, entry(15, [33]))
  mocks.get.mockImplementation(async (id: number) => local.get(id))
  mocks.put.mockImplementation(async (record: UserArchiveBody) => local.set(record.id, record))
  api.getAllHistoryArchive.mockImplementation(async () => ({ data: [...cloud.values()] }))
  api.getLastArchive.mockImplementation(async ({ pathParams }) => ({
    data: cloud.get(pathParams.slot_index)?.archive?.[0],
  }))
  api.createSlotAndSaveArchive.mockImplementation(async ({ pathParams, data }) => {
    if (cloud.has(pathParams.slot_index)) throw new Error('槽位已存在')
    seed(pathParams.slot_index, { time: new Date().toISOString(), archive: data })
    cloud.get(pathParams.slot_index)!.name = pathParams.name
  })
  api.saveArchive.mockImplementation(async ({ pathParams, data }) => {
    const index = pathParams.slot_index
    const slot = cloud.get(index)
    if (!slot) throw new Error('槽位不存在')
    seed(index, { time: new Date().toISOString(), archive: data }, ...(slot.archive ?? []))
  })
  api.removeArchive.mockImplementation(async ({ pathParams }) => {
    cloud.delete(pathParams.slot_index)
  })
  vi.stubGlobal('Apis', { archive: api })
  trackListeners(document)
  trackListeners(window)
})

afterEach(() => {
  listeners
    .splice(0)
    .forEach(({ target, type, listener }) => target.removeEventListener(type, listener))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('1 号槽位和旧存档迁移', () => {
  it('旧存档沿用各组件初始字体，字体改动按项目独立同步到 1 号槽位', async () => {
    const store = await start()
    const preferences = usePreferenceStore()
    expect(preferences).toMatchObject({
      mapLabelFont: 'HYWenHei-85W',
      genshinFont: 'HYWenHei-85W',
      elementFont: '',
      markerDescriptionFont: 'SarasaMono',
      noticeEditorFont: 'MHYG',
    })

    preferences.mapLabelFont = ''
    preferences.noticeEditorFont = '示例字体'
    seed(
      1,
      entry(40, [11], {
        ...preference('mapsetting'),
        'appearance.setting.elementFont': '云端字体',
      }),
    )
    await store.flush()

    expect(savedSlots()).toEqual([1])
    expect(body(1).Preference).toMatchObject({
      'appearance.setting.mapLabelFont': '',
      'appearance.setting.elementFont': '云端字体',
      'appearance.setting.noticeEditorFont': '示例字体',
    })
    expect(preferences.mapLabelFont).toBe('')
    expect(preferences.elementFont).toBe('云端字体')
  })

  it('1 号设置优先于较新的普通槽位及本地缓存，切换进度和读取旧历史都沿用它', async () => {
    local.set(7, {
      id: 7,
      timestamp: 1,
      body: { Data_KYJG: [], Time_KYJG: {}, Preference: preference('local') },
    })
    const store = await start()
    expect(store.currentArchive.slotIndex).toBe(2)
    expect(store.preference).toEqual(preference('mapsetting'))
    expect(store.archiveSlots[1]?.archiveList).toEqual([])
    expect(store.archiveSlots[2]?.archiveList).toHaveLength(2)
    await store.loadArchiveSlot(1)
    expect([...store.currentArchive.body.Data_KYJG]).toEqual([11])
    await store.loadHistoryArchive(2, 20)
    expect([...store.currentArchive.body.Data_KYJG]).toEqual([21])
    expect(store.preference).toEqual(preference('mapsetting'))
    expect(api.saveArchive).not.toHaveBeenCalled()
    await expect(store.loadHistoryArchive(1, 5)).rejects.toThrow('1 号')
    await expect(store.deleteArchiveSlot(1)).rejects.toThrow('1 号')
    await expect(store.createArchiveSlot('重复', 1)).rejects.toThrow()
    expect(api.removeArchive).not.toHaveBeenCalled()
  })

  it('首次缺少 1 号时只创建一次，迁移旧设置并保持原槽位的点位', async () => {
    cloud.delete(1)
    const store = await start()
    await Promise.all([store.fetchArchive(), store.fetchArchive()])
    expect(api.createSlotAndSaveArchive).toHaveBeenCalledTimes(1)
    expect(body(1)).toMatchObject({ Data_KYJG: [], Preference: preference('database') })
    expect(store.currentArchive.slotIndex).toBe(2)
    expect([...store.currentArchive.body.Data_KYJG]).toEqual([22])
  })

  it('云端为空时从同一账号的旧本地存档创建，游客存档独立', async () => {
    cloud.clear()
    local.set(-1, {
      id: -1,
      timestamp: 2,
      body: { Data_KYJG: [9], Time_KYJG: {}, Preference: preference('guest') },
    })
    local.set(7, {
      id: 7,
      timestamp: 3,
      body: { Data_KYJG: [4], Time_KYJG: { 4: '昨天' }, Preference: preference('local') },
    })
    const store = await start()
    expect(store.currentArchive.slotIndex).toBe(1)
    expect(body(1)).toMatchObject({
      Data_KYJG: [4],
      Time_KYJG: { 4: '昨天' },
      Preference: preference('local'),
    })
  })

  it('已有 1 号缺少设置时补齐一次，已有进度和名称继续可用', async () => {
    seed(1, entry(10, [8]))
    const store = await start()
    expect(body(1)).toMatchObject({ Data_KYJG: [8], Preference: preference('database') })
    expect(store.archiveSlots[1]?.name).toBe('存档 1')
    await store.fetchArchive()
    expect(api.saveArchive).not.toHaveBeenCalled()
    expect(api.createSlotAndSaveArchive).not.toHaveBeenCalled()
  })

  it('并发创建以回读的 1 号为准，网络错误不会被当成空槽位', async () => {
    cloud.delete(1)
    const store = useArchiveStore()
    api.getAllHistoryArchive.mockRejectedValueOnce(new Error('离线'))
    await store.init()
    await expect(store.fetchArchive()).rejects.toThrow('离线')
    expect(api.createSlotAndSaveArchive).not.toHaveBeenCalled()
    api.createSlotAndSaveArchive.mockImplementationOnce(async () => {
      seed(1, entry(12, [1], preference('other-device')))
      throw new Error('槽位已存在')
    })
    await store.fetchArchive()
    expect(store.preference).toEqual(preference('other-device'))
    expect(api.createSlotAndSaveArchive).toHaveBeenCalledTimes(1)
    expect(api.saveArchive).not.toHaveBeenCalled()
  })
})

describe('设置与进度分别同步', () => {
  it('旧存档默认关闭选址锁定，锁定设置由 1 号槽位同步', async () => {
    const store = await start()
    const preferences = usePreferenceStore()
    expect(preferences.lockPlacementReticle).toBe(false)

    preferences.lockPlacementReticle = true
    await store.flush()
    expect(savedSlots()).toEqual([1])
    expect(body(1).Preference['map.setting.lockPlacementReticle']).toBe(true)
    await store.loadArchiveSlot(3)
    expect(preferences.lockPlacementReticle).toBe(true)

    seed(
      1,
      entry(40, [11], { ...preference('mapsetting'), 'map.setting.lockPlacementReticle': false }),
    )
    await store.fetchArchive()
    expect(preferences.lockPlacementReticle).toBe(false)
  })

  it('只改设置只写 1 号，合并云端最新点位、刷新时间和进度时间', async () => {
    const store = await start()
    seed(1, {
      time: new Date(19).toISOString(),
      archive: JSON.stringify({
        Data_KYJG: [12],
        Time_KYJG: { 12: '今天' },
        Preference: preference('mapsetting'),
      }),
    })
    store.preference['settingPanel.state.activedKey'] = 'about'
    await store.flush()
    expect(savedSlots()).toEqual([1])
    expect(body(1)).toEqual({
      Data_KYJG: [12],
      Time_KYJG: { 12: '今天' },
      Preference: preference('about'),
      ProgressTime: 19,
    })
    expect(store.currentArchive.slotIndex).toBe(2)
    await store.loadLatestArchive()
    expect(store.currentArchive.slotIndex).toBe(2)
    expect(local.get(7)?.preference).toEqual(preference('about'))
  })

  it('同时编辑普通进度和设置时分别写入，切换前保存原槽位', async () => {
    const store = await start()
    store.currentArchive.body.Data_KYJG.add(23)
    store.preference = preference('manager')
    await store.loadArchiveSlot(3)
    expect(savedSlots()).toEqual([2, 1])
    expect(body(2)).toEqual({ Data_KYJG: [22, 23], Time_KYJG: {} })
    expect(body(1)).toMatchObject({ Data_KYJG: [11], Preference: preference('manager') })
    expect([...store.currentArchive.body.Data_KYJG]).toEqual([33])
    expect(local.get(7)?.slotIndex).toBe(3)
  })

  it('两台设备修改不同设置项时合并到 1 号槽位', async () => {
    const store = await start()
    seed(1, entry(40, [11], { ...preference('mapsetting'), 'map.setting.showZoneTag': false }))
    store.preference['settingPanel.state.activedKey'] = 'network'
    await store.flush()
    expect(body(1).Preference).toEqual({
      ...preference('network'),
      'map.setting.showZoneTag': false,
    })
    expect(store.preference).toEqual(body(1).Preference)
  })

  it('1 号激活时两种变更合并写一次，两个普通槽位分别保存进度', async () => {
    const store = await start()
    await store.loadArchiveSlot(1)
    store.currentArchive.body.Data_KYJG.add(12)
    store.preference = preference('app')
    await store.flush()
    expect(savedSlots()).toEqual([1])
    expect(body(1)).toMatchObject({ Data_KYJG: [11, 12], Preference: preference('app') })
    await store.saveArchiveToSlot(2)
    await store.saveArchiveToSlot(3)
    expect(body(2)).toEqual({ Data_KYJG: [11, 12], Time_KYJG: {} })
    expect(body(3)).toEqual(body(2))
  })

  it('新建空白或复制进度的普通槽位都省略设置，显式保存到 1 号保留云端设置', async () => {
    const store = await start()
    await store.createArchiveSlot('复制', 4)
    await store.createArchiveSlot('空白', 5, false)
    expect(body(4)).toEqual({ Data_KYJG: [22], Time_KYJG: {} })
    expect(body(5)).toEqual({ Data_KYJG: [], Time_KYJG: {} })
    seed(1, entry(40, [11], preference('another-device')))
    await store.saveArchiveToSlot(1)
    expect(body(1)).toMatchObject({ Data_KYJG: [22], Preference: preference('another-device') })
    expect(store.preference).toEqual(preference('another-device'))
    expect(local.get(7)?.preference).toEqual(store.preference)
  })

  it('新设备按点位进度时间选取最新存档，已有设备恢复上次选择', async () => {
    seed(1, {
      time: new Date(99).toISOString(),
      archive: JSON.stringify({ Data_KYJG: [11], Preference: {}, ProgressTime: 10 }),
    })
    local.set(7, { id: 7, slotIndex: 3, timestamp: 15, body: { Data_KYJG: [33], Time_KYJG: {} } })
    const store = await start()
    expect(store.currentArchive.slotIndex).toBe(3)
    expect(store.preference).toEqual({})
    await store.loadLatestArchive()
    expect(store.currentArchive.slotIndex).toBe(2)
  })

  it('游客的设置和进度仅保存到游客缓存', async () => {
    auth.userId = undefined
    const store = await start()
    store.preference = preference('guest')
    store.currentArchive.body.Data_KYJG.add(9)
    await store.flush()
    expect(local.get(-1)).toMatchObject({
      body: { Data_KYJG: [9] },
      preference: preference('guest'),
    })
    expect(api.getAllHistoryArchive).not.toHaveBeenCalled()
    expect(api.saveArchive).not.toHaveBeenCalled()
  })
})

describe('同步时序与恢复', () => {
  it('300ms 去抖合并连续变更，本地与云端保存同一份点位快照', async () => {
    const store = await start()
    store.currentArchive.body.Data_KYJG.add(23)
    await nextTick()
    store.currentArchive.body.Data_KYJG.add(24)
    await nextTick()
    await vi.advanceTimersByTimeAsync(299)
    expect(mocks.put).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(savedSlots()).toEqual([2])
    expect(body(2).Data_KYJG).toEqual([22, 23, 24])
    expect(local.get(7)?.body).toEqual(body(2))
    await store.flush()
    expect(savedSlots()).toEqual([2])
  })

  it('串行执行保存并在切换前排空旧槽位，等待期间新增的点位也归旧槽位', async () => {
    const store = await start()
    const pending = Promise.withResolvers<void>()
    const save = api.saveArchive.getMockImplementation()!
    api.saveArchive.mockImplementationOnce(async request => {
      await pending.promise
      await save(request)
    })
    store.currentArchive.body.Data_KYJG.add(23)
    const selecting = store.loadArchiveSlot(3)
    await vi.advanceTimersByTimeAsync(0)
    store.currentArchive.body.Data_KYJG.add(24)
    expect(savedSlots()).toEqual([2])
    pending.resolve()
    await selecting
    expect(savedSlots()).toEqual([2, 2])
    expect(body(2).Data_KYJG).toEqual([22, 23, 24])
    expect(store.currentArchive.slotIndex).toBe(3)
  })

  it('显式保存支持重复写入，元数据和未改动的自动同步均跳过', async () => {
    const store = await start()
    store.currentArchive.timestamp = Date.now()
    await vi.advanceTimersByTimeAsync(500)
    await store.flush()
    expect(mocks.put).not.toHaveBeenCalled()
    expect(api.saveArchive).not.toHaveBeenCalled()
    await store.saveArchiveToSlot(3)
    await store.saveArchiveToSlot(3)
    expect(savedSlots()).toEqual([3, 3])
  })

  it('写入失败退避重试，部分成功后只重试尚未确认的 1 号设置', async () => {
    const store = await start()
    const save = api.saveArchive.getMockImplementation()!
    api.saveArchive.mockImplementation(async request => {
      if (request.pathParams.slot_index === 1) throw new Error('离线')
      await save(request)
    })
    store.currentArchive.body.Data_KYJG.add(23)
    store.preference = preference('about')
    await expect(store.flush()).rejects.toThrow('离线')
    expect(savedSlots()).toEqual([2, 1, 1, 1])
    expect(mocks.sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000])
    expect(local.get(7)?.preference).toEqual(preference('about'))
    expect(local.get(7)?.pending).toEqual({ progress: false, preference: true })
    api.saveArchive.mockImplementation(save)
    await store.flush()
    expect(savedSlots()).toEqual([2, 1, 1, 1, 1])
    expect(local.get(7)?.pending).toBeUndefined()
  })

  it('普通槽位保存失败仍可同步设置，恢复后只补写该槽位', async () => {
    const store = await start()
    const save = api.saveArchive.getMockImplementation()!
    api.saveArchive.mockImplementation(async request => {
      if (request.pathParams.slot_index === 2) throw new Error('普通槽位暂不可用')
      await save(request)
    })
    store.currentArchive.body.Data_KYJG.add(24)
    store.preference = preference('network')
    await expect(store.flush()).rejects.toThrow('普通槽位暂不可用')
    expect(savedSlots()).toEqual([2, 2, 2, 1])
    expect(body(1).Preference).toEqual(preference('network'))
    expect(local.get(7)?.pending).toEqual({ progress: true, preference: false })
    api.saveArchive.mockImplementation(save)
    await store.flush()
    expect(savedSlots()).toEqual([2, 2, 2, 1, 2])
    expect(body(2)).toEqual({ Data_KYJG: [22, 24], Time_KYJG: {} })
  })

  it('页面隐藏、离开时立即同步', async () => {
    const store = await start()
    store.currentArchive.body.Data_KYJG.add(25)
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    expect(savedSlots()).toEqual([2])
    store.preference = preference('network')
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(savedSlots()).toEqual([2, 1])
  })

  it('账号切换时放弃上个账号的迟到响应，并将未保存设置留给原账号', async () => {
    const store = await start()
    const reading = Promise.withResolvers<{ data?: SysArchiveVo }>()
    api.getLastArchive.mockReturnValueOnce(reading.promise)
    store.preference = preference('developer')
    const saving = store.flush()
    await vi.advanceTimersByTimeAsync(0)
    auth.userId = 8
    seed(1, entry(50, [88], preference('account-8')))
    await store.fetchArchive()
    reading.resolve({ data: entry(10, [11], preference('mapsetting')) })
    await expect(saving).rejects.toThrow('账号已切换')
    expect(store.preference).toEqual(preference('account-8'))
    expect(local.get(7)?.preference).toEqual(preference('developer'))
    expect(api.saveArchive).not.toHaveBeenCalled()
  })
})
