import type { MarkerVo, TweakVo } from '@/api/alova/globals'
import type { WorkerInput, WorkerOutput } from '@/worker/idb.worker'
import { AddLocation, DeleteLocation, Location } from '@element-plus/icons-vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import Apis from '@/api/alova'
import db from '@/database'
import BulkPutWorker from '@/worker/idb.worker?worker'
import { Logger } from '@/utils'
import { useAccessStore, useSocketStore, useUserStore } from '.'
import { useManager } from './hooks'
import { diffMarkers, getCostTime, isAccessible } from './utils'
import { fetchMarkersByIds } from './utils/fetchMarkersByIds'

const logger = new Logger('Marker')

/** 单次点位查询的数量上限，服务端对 `markerIdList` 有长度限制 */
const QUERY_LIMIT = 100

/** 分片查询的并发数 */
const QUERY_CONCURRENCY = 4

interface ManagerContext {
  startTime: Ref<number>
  message: Ref<string>
  tag: Ref<string>
}

interface DiffData {
  updateList: MarkerVo[]
  deleteIds: number[]
  clear?: boolean
}

/** 全量点位的全局数据 */
export const useMarkerStore = defineStore('global-marker', () => {
  const accessStore = useAccessStore()
  const socketStore = useSocketStore()
  const userStore = useUserStore()

  // ============================== 内部状态 ==============================

  /** 点位 id 索引表 */
  const localMarkerMap = shallowRef(new Map<number, MarkerVo>())

  // ============================== 代理方法 ==============================

  /**
   * @local 更新本地点位
   * - 已包含 version 比较逻辑
   */
  const updateLocal = (options: {
    updateList?: MarkerVo[]
    deleteIds?: number[]
    /** 清空本地数据后再写入（全量更新时使用） */
    clear?: boolean
  }) => {
    const { updateList = [], deleteIds = [], clear = false } = options
    if (!updateList.length && !deleteIds.length && !clear) return
    if (clear) localMarkerMap.value = new Map()
    const { length: deleteLength } = deleteIds
    for (let i = 0; i < deleteLength; i++) {
      const id = deleteIds[i]
      localMarkerMap.value.delete(id)
    }
    const { length: updateLength } = updateList
    for (let i = 0; i < updateLength; i++) {
      const marker = updateList[i]
      const { id, version = 0, linkageId } = marker
      // 索引表以数值 id 为键，非法 id 写入后会污染整张表（例如 Long 实例）
      if (typeof id !== 'number' || !Number.isFinite(id)) continue
      const localMarker = localMarkerMap.value.get(id)
      if (localMarker) {
        // 服务端数据比本地旧（乱序到达的 socket 事件等），丢弃以免把本地改回旧版本
        if (version < (localMarker.version ?? 0)) continue
        // 版本与关联都没有变化，无需替换对象引用
        if (
          version === (localMarker.version ?? 0)
          && (linkageId ?? '') === (localMarker.linkageId ?? '')
        )
          continue
      }
      localMarkerMap.value.set(id, marker)
    }
    triggerRef(localMarkerMap)
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
  }

  /** @server 删除点位 */
  const deleteMarker = async (markerId: number) => {
    const { data: isSuccess, message } = await Apis.marker.deleteMarker({
      pathParams: { markerId },
    })
    if (!isSuccess) throw new Error(message)
    updateLocal({ deleteIds: [markerId] })
  }

  /** @server 批量操作点位 */
  const tweakMarkers = async (tweaks: TweakVo[]) => {
    const { data = [] } = await Apis.marker.tweakMarkers({ data: tweaks })
    updateLocal({ updateList: data })
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

  const {
    context,
    isActive,
    error: managerError,
    nextUpdateTime,
    loading: updateLoading,
    update,
  } = useManager<ManagerContext, DiffData | void>({
    timeoutPull: {
      time: 60 * 60 * 1000,
      condition: () => userStore.info?.roleId !== undefined,
    },

    context: {
      startTime: ref(0),
      message: ref(''),
      tag: ref(''),
    },

    syncState: async (data, context) => {
      if (!data) return
      const { updateList, deleteIds, clear } = data
      if (!updateList.length && !deleteIds.length && !clear) {
        context.message.value = [
          `[${context.tag.value}] `,
          '没有需要更新的数据，',
          `耗时 ${getCostTime(context.startTime.value).toFixed(1)}s`,
        ].join('')
        return
      }
      updateLocal(data)
      context.message.value = [
        `[${context.tag.value}] `,
        `更新(${updateList.length})，`,
        `删除(${deleteIds.length})，`,
        `耗时：${getCostTime(context.startTime.value).toFixed(1)}s`,
      ].join('')
    },

    commit: data => {
      if (!data) return
      const { updateList, deleteIds, clear } = data
      if (!updateList.length && !deleteIds.length && !clear) return
      const worker = new BulkPutWorker({ name: '点位更新线程' })
      worker.addEventListener('message', (ev: MessageEvent<WorkerOutput>) => {
        worker.terminate()
        const { error, message } = ev.data ?? {}
        // 写入失败时至少留下痕迹，否则本地缓存与内存状态会静默错位
        if (error) logger.error(`本地点位写入失败：${message}`)
      })
      worker.addEventListener('error', ev => {
        worker.terminate()
        logger.error(`本地点位写入线程异常：${ev.message}`)
      })
      worker.postMessage(<WorkerInput<number, MarkerVo>>{
        tableName: 'marker',
        clear,
        bulkPutData: updateList,
        bulkDeleteKeys: deleteIds,
      })
    },

    init: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '初始化'
      context.message.value = `[${context.tag.value}] 拉取冷数据...`
      const localMarkers = await db.marker.toArray()
      updateLocal({ updateList: localMarkers })
    },

    diff: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '差异'
      context.message.value = `[${context.tag.value}] 拉取比对快照...`
      // 快照请求期间可能有点位被新增，先记录当前本地 id，避免被误判为已删除
      const ownedIds = new Set(localMarkerMap.value.keys())
      const { snapshots } = await Apis.marker_doc.listMarkerDiffSnapshotByBinary()
      if (!Array.isArray(snapshots)) throw new Error('点位差异快照响应异常')
      context.message.value = `[${context.tag.value}] 计算差异...`
      const { fetchIds, patches, deleteIds } = await diffMarkers(
        snapshots,
        localMarkerMap.value,
        ownedIds,
      )
      let updateList: MarkerVo[] = []
      if (fetchIds.length) {
        context.message.value = `[${context.tag.value}] 拉取更新数据 (0/${fetchIds.length})...`
        updateList = await fetchMarkersByIds(fetchIds, {
          limit: QUERY_LIMIT,
          concurrency: QUERY_CONCURRENCY,
          onProgress: (loaded, total) => {
            context.message.value = `[${context.tag.value}] 拉取更新数据 (${loaded}/${total})...`
          },
        })
      }
      // 关联变更不会提升 version，快照里的 linkageId 已经是权威值，就地修正后一并写入本地缓存
      for (let i = 0; i < patches.length; i++) {
        const { id, linkageId } = patches[i]
        const localMarker = localMarkerMap.value.get(id)
        if (!localMarker) continue
        localMarker.linkageId = linkageId
        updateList.push(localMarker)
      }
      return { updateList, deleteIds }
    },

    full: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '全量'
      context.message.value = `[${context.tag.value}] 正在获取点位数据...`
      const updateList = await Apis.marker_doc.listMarkersByBinary()
      return { updateList, deleteIds: [] as number[], clear: true }
    },
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
    updateLocal({ updateList: data })
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
