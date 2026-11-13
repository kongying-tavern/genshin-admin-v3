import type { MarkerVo, TweakVo } from '@/api/alova/globals'
import { AddLocation, DeleteLocation, Location } from '@element-plus/icons-vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import Apis from '@/api/alova'
import db from '@/database'
import { Logger, messageFrom, yieldToMain } from '@/utils'
import { useAccessStore, useSocketStore, useUserStore } from '.'
import { useManager } from './hooks'
import {
  chunk,
  forEachChunk,
  getCostTime,
  isAccessible,
  retry,
  runShards,
  writeLocalTable,
} from './utils'

interface ManagerContext {
  startTime: Ref<number>
  message: Ref<string>
  tag: Ref<string>
}

/** 单个分片包含的点位数量 */
const SHARD_SIZE = 1000
/** 分片请求的最大并发数 */
const SHARD_CONCURRENCY = 4
/** 单个分片的最大尝试次数 */
const SHARD_RETRY_LIMIT = 3
/** 累计失败多少个分片后判定接口不可用，中止剩余分片 */
const SHARD_ABORT_THRESHOLD = 3
/** 单次分片请求的超时时间（毫秒） */
const SHARD_TIMEOUT = 20_000
/** 全量数据写入本地库时的分块大小 */
const PERSIST_CHUNK_SIZE = 2000
/** 差异计算时让出主线程的间隔（条） */
const DIFF_YIELD_INTERVAL = 4000
/** 渐进式更新合并视图刷新的最短间隔（毫秒） */
const NOTIFY_INTERVAL = 150

/** 同步阶段 */
export type MarkerSyncPhase =
  | 'idle'
  | 'init'
  | 'snapshot'
  | 'diff'
  | 'fetch'
  | 'persist'
  | 'prune'

/** 同步进度，供 UI 展示 */
export interface MarkerSyncProgress {
  phase: MarkerSyncPhase
  /** 已完成的单位数（分片数或条数） */
  finished: number
  /** 总单位数，0 表示未知 */
  total: number
  /** 失败的单位数 */
  failed: number
}

const getMarkersByIds = async (ids: number[]) => {
  if (!ids.length) return []
  const { data = [] } = await Apis.marker.listMarkerById({ data: { markerIdList: ids } })
  return data
}

/**
 * 计算本地点位与服务器快照的差异
 *
 * 大数组遍历时按 `DIFF_YIELD_INTERVAL` 让出主线程，避免长时间阻塞渲染
 */
const diffMapMarkers = async (
  snapshots: {
    id?: number | null
    version?: number | null
    linkageId?: string | null
  }[],
  markerMap: Map<number, MarkerVo>,
  onProgress?: (finished: number, total: number) => void,
) => {
  const deleteIds = new Set(markerMap.keys())
  const updateIds = new Set<number>()
  const { length } = snapshots
  for (let i = 0; i < length; i++) {
    if (i > 0 && i % DIFF_YIELD_INTERVAL === 0) {
      onProgress?.(i, length)
      await yieldToMain()
    }
    const { id, version, linkageId } = snapshots[i]
    if (!id || !version) continue
    deleteIds.delete(id)
    const currentMarker = markerMap.get(id)
    if (!currentMarker) {
      updateIds.add(id)
      continue
    }
    if ((currentMarker.version ?? 0) < version) {
      updateIds.add(id)
      continue
    }
    if ((linkageId ?? '') !== (currentMarker.linkageId ?? '')) {
      updateIds.add(id)
      continue
    }
  }
  onProgress?.(length, length)
  return {
    updateIds: [...updateIds],
    deleteIds: [...deleteIds],
  }
}

/** 全量点位的全局数据 */
export const useMarkerStore = defineStore('global-marker', () => {
  const accessStore = useAccessStore()
  const socketStore = useSocketStore()
  const userStore = useUserStore()

  const logger = new Logger('点位同步')

  // ============================== 内部状态 ==============================

  /** 点位 id 索引表 */
  const localMarkerMap = shallowRef(new Map<number, MarkerVo>())

  /** 同步进度 */
  const syncProgress = shallowRef<MarkerSyncProgress>({
    phase: 'idle',
    finished: 0,
    total: 0,
    failed: 0,
  })

  /** 同步告警：数据不完整但不致命的情况（部分分片失败、本地库读写异常等） */
  const syncWarning = ref('')

  // ---------------------------- 视图刷新节流 ----------------------------

  let notifyTimer: ReturnType<typeof setTimeout> | undefined
  let notifyDirty = false

  const flushNotify = () => {
    if (notifyTimer) {
      clearTimeout(notifyTimer)
      notifyTimer = undefined
    }
    if (!notifyDirty) return
    notifyDirty = false
    triggerRef(localMarkerMap)
  }

  /**
   * 请求一次视图刷新
   *
   * 分片更新时若每片都触发，`markerList` 及下游的过滤器、计数、deck.gl 图层
   * 会被重算几十次；这里按 `NOTIFY_INTERVAL` 合并，既保证看得到渐进效果，
   * 又不会把主线程打满。
   */
  const notifyLocal = (immediate = true) => {
    notifyDirty = true
    if (immediate) {
      flushNotify()
      return
    }
    if (notifyTimer) return
    notifyTimer = setTimeout(flushNotify, NOTIFY_INTERVAL)
  }

  const setProgress = (progress: Partial<MarkerSyncProgress> & { phase: MarkerSyncPhase }) => {
    syncProgress.value = { ...syncProgress.value, ...progress }
  }

  // ============================== 代理方法 ==============================

  /**
   * @local 更新本地点位
   * - 已包含 version 比较逻辑
   * @param immediate 是否立即触发视图刷新；批量更新时传 `false` 以合并刷新
   */
  const updateLocal = (options: {
    updateList?: MarkerVo[]
    deleteIds?: number[]
    immediate?: boolean
  }) => {
    const { updateList = [], deleteIds = [], immediate = true } = options
    if (!updateList.length && !deleteIds.length) return
    const map = localMarkerMap.value
    let changed = false
    const { length: deleteLength } = deleteIds
    for (let i = 0; i < deleteLength; i++) {
      changed = map.delete(deleteIds[i]) || changed
    }
    const { length: updateLength } = updateList
    for (let i = 0; i < updateLength; i++) {
      const marker = updateList[i]
      const { id, version = 0, linkageId } = marker
      if (id === undefined) continue
      const localMarker = map.get(id)
      // 仅当新数据版本更高，或关联发生变化时（关联变更不影响 version）才覆盖
      if (localMarker) {
        const isNewer = version > (localMarker.version ?? 0)
        const isLinkageChanged = (linkageId ?? '') !== (localMarker.linkageId ?? '')
        if (!isNewer && !isLinkageChanged) continue
      }
      map.set(id, marker)
      changed = true
    }
    // 没有任何实际变化时不触发刷新，避免下游做无意义的重算
    if (changed) notifyLocal(immediate)
  }

  /** @server 创建点位 */
  const createMarker = async (markerForm: MarkerVo) => {
    const { data: markerId } = await Apis.marker.createMarker({ data: markerForm })
    if (!markerId) throw new Error('服务器未返回新点位 id')
    const { data: [marker] = [] } = await Apis.marker.listMarkerById({
      data: { markerIdList: [markerId] },
    })
    if (!marker) throw new Error('服务器未返回新点位数据')
    updateLocal({ updateList: [marker] })
    await persistMarkers({ updateList: [marker] })
  }

  /** @server 更新点位 */
  const updateMarker = async (markerForm: MarkerVo) => {
    if (!markerForm.id) throw new Error('点位 id 为空')
    const { data: isSuccess, message } = await Apis.marker.updateMarker({ data: markerForm })
    if (!isSuccess) throw new Error(message)
    const { data: [marker] = [] } = await Apis.marker.listMarkerById({
      data: { markerIdList: [markerForm.id] },
    })
    if (!marker) throw new Error('服务器未返回新点位数据')
    updateLocal({ updateList: [marker] })
    await persistMarkers({ updateList: [marker] })
  }

  /** @server 删除点位 */
  const deleteMarker = async (markerId: number) => {
    const { data: isSuccess, message } = await Apis.marker.deleteMarker({
      pathParams: { markerId },
    })
    if (!isSuccess) throw new Error(message)
    updateLocal({ deleteIds: [markerId] })
    await persistMarkers({ deleteIds: [markerId] })
  }

  /** @server 批量操作点位 */
  const tweakMarkers = async (tweaks: TweakVo[]) => {
    const { data = [] } = await Apis.marker.tweakMarkers({ data: tweaks })
    updateLocal({ updateList: data, immediate: data.length <= SHARD_SIZE })
    await persistMarkers({ updateList: data })
  }

  // ============================== 本地持久化 ==============================

  /**
   * 将变更写入本地数据库
   *
   * 写入失败不影响内存中的点位（地图仍然是可用的），但必须暴露出来，
   * 否则下次冷启动会看到「已经删掉的点位又回来了」。
   */
  const persistMarkers = async (options: { updateList?: MarkerVo[]; deleteIds?: number[] }) => {
    const { updateList = [], deleteIds = [] } = options
    if (!updateList.length && !deleteIds.length) return
    try {
      await writeLocalTable<number, MarkerVo>({
        tableName: 'marker',
        bulkPutData: updateList,
        bulkDeleteKeys: deleteIds,
      })
    } catch (err) {
      const message = messageFrom(err, '未知错误')
      logger.error('写入本地点位数据库失败:', err)
      syncWarning.value = `本地点位数据库写入失败：${message}`
    }
  }

  // ============================== 外部状态 ==============================

  /** 经过 hiddenFlag 过滤后的点位列表 */
  const list = computed(() => {
    const res: MarkerVo[] = []
    const { userHiddenFlagMask } = accessStore
    localMarkerMap.value.forEach(marker => {
      if (!isAccessible(userHiddenFlagMask, marker.hiddenFlag)) return
      res.push(marker)
    })
    return res
  })

  const total = computed(() => list.value.length)

  // ============================== 数据更新 ==============================

  /**
   * 分片拉取点位并「边拉边应用」
   *
   * 每个分片成功后会立刻写入内存与本地库，因此地图不必等待全部数据；
   * 单个分片耗尽重试后只影响自己，通过返回值与 `syncWarning` 反馈。
   */
  const fetchMarkersByShards = async (ids: number[], context: ManagerContext) => {
    const shards = chunk(ids, SHARD_SIZE)
    const { length: shardTotal } = shards
    let failedCount = 0
    let failedShards = 0
    let aborted = false

    /** 过半分片失败时判定为接口整体不可用，避免死等几分钟的重试 */
    const isEndpointBroken = () => failedShards >= SHARD_ABORT_THRESHOLD && failedShards * 2 >= shardTotal

    setProgress({ phase: 'fetch', finished: 0, total: shardTotal, failed: 0 })

    const { failures } = await runShards({
      shards,
      concurrency: SHARD_CONCURRENCY,
      retryLimit: SHARD_RETRY_LIMIT,
      retryDelay: 800,
      timeout: SHARD_TIMEOUT,

      shouldAbort: () => {
        if (!isEndpointBroken()) return false
        aborted = true
        return true
      },

      run: shard => getMarkersByIds(shard),

      onSuccess: async markers => {
        if (!markers.length) return
        updateLocal({ updateList: markers, immediate: false })
        await writeLocalTable<number, MarkerVo>({ tableName: 'marker', bulkPutData: markers })
      },

      onFailure: (failure, shard) => {
        failedShards += 1
        failedCount += shard.length
        logger.error(
          `分片 #${failure.index + 1} 拉取失败（已完成 ${failure.attempts} 次尝试）`,
          failure.error,
        )
      },

      onSettled: ({ finished, total, failed }) => {
        setProgress({ phase: 'fetch', finished, total, failed })
        // 分片级进度直接写进 message，用户在设置面板里能看到「拉到哪了」
        context.message.value = `[${context.tag.value}] 拉取点位数据 ${finished}/${total} 片${
          failed ? `，失败 ${failed} 片` : ''
        }`
      },
    })

    // 兜底刷新，确保被节流合并的最后一批数据一定会上图
    flushNotify()

    return { failures, failedCount, aborted }
  }

  const buildSummary = (context: ManagerContext, summary: string) =>
    `[${context.tag.value}] ${summary}，耗时 ${getCostTime(context.startTime.value).toFixed(1)}s`

  /** 差异更新：快照 → 计算差异 → 分片拉取并渐进应用 */
  const diffUpdate = async (context: ManagerContext) => {
    // 1. 拉取轻量快照（仅 id / version / linkageId）
    setProgress({ phase: 'snapshot', finished: 0, total: 0, failed: 0 })
    context.message.value = `[${context.tag.value}] 拉取比对快照...`
    const { snapshots } = await retry(() => Apis.marker_doc.listMarkerDiffSnapshotByBinary(), {
      retryLimit: 2,
      retryDelay: 1000,
      timeout: 60_000,
    })

    // 2. 计算差异
    setProgress({ phase: 'diff', finished: 0, total: snapshots.length, failed: 0 })
    context.message.value = `[${context.tag.value}] 计算差异 (${snapshots.length})...`
    const { updateIds, deleteIds } = await diffMapMarkers(
      snapshots,
      localMarkerMap.value,
      (finished, total) => {
        setProgress({ phase: 'diff', finished, total, failed: 0 })
        context.message.value = `[${context.tag.value}] 计算差异 ${finished}/${total}`
      },
    )

    // 3. 删除先落地：不需要网络，能让列表立刻变干净
    if (deleteIds.length) {
      updateLocal({ deleteIds, immediate: false })
      await persistMarkers({ deleteIds })
    }

    if (!updateIds.length) {
      flushNotify()
      context.message.value = buildSummary(context, `没有需要更新的数据，删除(${deleteIds.length})`)
      return
    }

    // 4. 分片拉取并渐进应用
    const { failures, failedCount, aborted } = await fetchMarkersByShards(updateIds, context)

    // 5. 汇总
    if (failures.length) {
      const detail = failures[0].error.message
      syncWarning.value = [
        `[${context.tag.value}] `,
        `${failures.length} 个分片拉取失败，约 ${failedCount} 个点位未更新：${detail}`,
        aborted ? '（失败过多，已中止剩余分片）' : '',
      ].join('')
      context.message.value = buildSummary(
        context,
        `更新(${updateIds.length - failedCount})，删除(${deleteIds.length})，失败(${failures.length} 片 / ${failedCount} 个)`,
      )
      return
    }

    context.message.value = buildSummary(
      context,
      `更新(${updateIds.length})，删除(${deleteIds.length})`,
    )
  }

  /** 全量更新：整包拉取 → 分块应用 → 清理服务端已删除的点位 */
  const fullUpdate = async (context: ManagerContext) => {
    setProgress({ phase: 'persist', finished: 0, total: 0, failed: 0 })
    context.message.value = `[${context.tag.value}] 正在获取点位数据...`

    let markers: MarkerVo[]
    try {
      markers = await retry(() => Apis.marker_doc.listMarkersByBinary(), {
        retryLimit: 2,
        retryDelay: 1000,
        timeout: 120_000,
      })
    } catch (err) {
      // 整包请求失败（网关超时 / 响应体过大 / 服务端异常）时不再让整次更新失败，
      // 而是降级成分片同步：至少把能拿到的数据先落到地图上
      const message = messageFrom(err, '未知错误')
      logger.error('获取点位全量数据失败，降级为分片同步:', err)
      context.tag.value = '全量(降级)'
      context.message.value = `[全量] 整包获取失败：${message}，正在降级为分片同步...`
      await diffUpdate(context)
      return
    }

    // 先记录本地已有点位，等全部写入成功后再删除服务端已经不存在的点位
    // （旧实现直接 clear 整表，一旦中途失败本地缓存就空了）
    let staleIds: Set<number>
    try {
      staleIds = new Set((await db.marker.toCollection().primaryKeys()) as number[])
    } catch (err) {
      logger.error('读取本地点位 id 失败，跳过清理阶段:', err)
      staleIds = new Set()
    }

    const { length: markerTotal } = markers
    let written = 0
    let writeFailed = 0

    await forEachChunk(markers, PERSIST_CHUNK_SIZE, async (slice, { index, total }) => {
      updateLocal({ updateList: slice, immediate: false })
      try {
        await writeLocalTable<number, MarkerVo>({ tableName: 'marker', bulkPutData: slice })
      } catch (err) {
        writeFailed += slice.length
        logger.error(`写入第 ${index + 1}/${total} 批点位失败:`, err)
      }
      for (let i = 0; i < slice.length; i++) {
        const { id } = slice[i]
        if (id !== undefined) staleIds.delete(id)
      }
      written += slice.length
      setProgress({ phase: 'persist', finished: written, total: markerTotal, failed: writeFailed })
      context.message.value = `[${context.tag.value}] 写入点位 ${written}/${markerTotal}`
    })

    flushNotify()

    // 全部写入成功后才清理残留，避免「写一半 + 清空」造成的数据空洞
    if (writeFailed) {
      syncWarning.value = `[${context.tag.value}] ${writeFailed} 个点位写入本地数据库失败，请重试`
    } else if (staleIds.size) {
      setProgress({ phase: 'prune', finished: 0, total: staleIds.size, failed: 0 })
      const ids = [...staleIds]
      updateLocal({ deleteIds: ids })
      await persistMarkers({ deleteIds: ids })
      context.message.value = buildSummary(
        context,
        `更新(${markerTotal})，清理已删除点位(${ids.length})`,
      )
      return
    }

    context.message.value = buildSummary(context, `更新(${markerTotal})`)
  }

  const {
    context,
    isActive,
    error: managerError,
    nextUpdateTime,
    loading: updateLoading,
    update,
  } = useManager<ManagerContext, void>({
    timeoutPull: {
      time: 60 * 60 * 1000,
      condition: () => userStore.info?.roleId !== undefined,
    },

    context: {
      startTime: ref(0),
      message: ref(''),
      tag: ref(''),
    },

    init: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '初始化'
      setProgress({ phase: 'init', finished: 0, total: 0, failed: 0 })
      context.message.value = `[${context.tag.value}] 读取本地数据...`
      try {
        const localMarkers = await db.marker.toArray()
        updateLocal({ updateList: localMarkers })
      } catch (err) {
        // 本地库读不出来不应该阻断同步，按冷启动处理，交给后续的差异/全量补齐
        logger.error('读取本地点位数据失败:', err)
        syncWarning.value = `读取本地点位数据库失败：${messageFrom(err, '未知错误')}`
      }
    },

    diff: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '差异'
      syncWarning.value = ''
      try {
        await diffUpdate(context)
      } finally {
        // 无论成功失败都要收尾，否则进度会永久停在某个中间阶段
        setProgress({ phase: 'idle' })
      }
    },

    full: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '全量'
      syncWarning.value = ''
      try {
        await fullUpdate(context)
      } finally {
        setProgress({ phase: 'idle' })
      }
    },

    // 数据已在拉取过程中分片写入，无需在结束后再整体提交一次
    commit: () => {},
  })

  // ============================== 外部响应 ==============================

  // 单个点位更新
  socketStore.appEvent.on('MarkerUpdated', async (markerInfo, userInfo) => {
    const { id, markerTitle, updaterId } = markerInfo
    if (!id) return
    const { username = `(uid: ${updaterId})`, nickname } = userInfo
    updateLocal({ updateList: [markerInfo] })
    socketStore.notice('MarkerUpdated', {
      message: `${nickname ?? username} 更新了点位 ${markerTitle} (id:${id})`,
      icon: Location,
      customClass: 'text-[var(--el-color-primary)]',
    })
  })

  // 单个点位新增
  socketStore.appEvent.on('MarkerAdded', async (markerInfo, userInfo) => {
    const { id, markerTitle, creatorId } = markerInfo
    if (!id) return
    const { username = `(uid: ${creatorId})`, nickname } = userInfo
    updateLocal({ updateList: [markerInfo] })
    socketStore.notice('MarkerAdded', {
      message: `${nickname ?? username} 新增了点位 ${markerTitle} (id:${id})`,
      icon: AddLocation,
      customClass: 'text-[var(--el-color-success)]',
    })
  })

  // 单个点位删除
  socketStore.appEvent.on('MarkerDeleted', async (markerInfo, userInfo) => {
    const { id, markerTitle, creatorId } = markerInfo
    if (!id) return
    const { username = `(uid: ${creatorId})`, nickname } = userInfo
    updateLocal({ deleteIds: [id] })
    socketStore.notice('MarkerDeleted', {
      message: `${nickname ?? username} 删除了点位 ${markerTitle} (id:${id})`,
      icon: DeleteLocation,
      customClass: 'text-[var(--el-color-danger)]',
    })
  })

  // 点位批量更新
  socketStore.appEvent.on('MarkerTweaked', async (data, userInfo) => {
    if (!data.length) return
    const [{ updaterId }] = data
    const { username = `(uid: ${updaterId})`, nickname } = userInfo
    updateLocal({ updateList: data, immediate: data.length <= SHARD_SIZE })
    socketStore.notice('MarkerTweaked', {
      message: `${nickname ?? username} 批量更新了 ${data.length} 个点位`,
      icon: Location,
      customClass: 'text-[var(--el-color-success)]',
    })
  })

  return {
    // 数据更新
    context,
    isActive,
    managerError,
    nextUpdateTime,
    updateLoading,
    update,
    updateLocal,

    /** 同步进度（阶段 / 已完成 / 失败分片数） */
    syncProgress,
    /** 同步告警，非空时应当提示用户数据可能不完整 */
    syncWarning,

    createMarker,
    updateMarker,
    deleteMarker,
    tweakMarkers,

    // 计算状态
    markerList: list,
    total,
    idMap: localMarkerMap,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMarkerStore, import.meta.hot))
}
