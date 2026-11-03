import type { MarkerVo, TweakVo } from '@/api/alova/globals'
import type { WorkerInput } from '@/worker/idb.worker'
import { AddLocation, DeleteLocation, Location } from '@element-plus/icons-vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import Apis from '@/api/alova'
import db from '@/database'
import BulkPutWorker from '@/worker/idb.worker?worker'
import { useAccessStore, useSocketStore, useUserStore } from '.'
import { useManager } from './hooks'
import { getCostTime, isAccessible } from './utils'

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

const getMarkersByIds = async (ids: number[]) => {
  if (!ids.length) return []
  const { data = [] } = await Apis.marker.listMarkerById({ data: { markerIdList: ids } })
  return data
}

const diffMapMarkers = async (
  snapshots: {
    id?: number | null
    version?: number | null
    linkageId?: string | null
  }[],
  markerMap: Map<number, MarkerVo>,
) => {
  const deleteIds = new Set(markerMap.keys())
  const updateIds = new Set<number>()
  let count = 0
  const { length } = snapshots
  for (let i = 0; i < length; i++) {
    count++
    if (count % 2000 === 0) await scheduler.yield() // 每 2000 个点位等一次，避免卡顿
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

  // ============================== 内部状态 ==============================

  /** 点位 id 索引表 */
  const localMarkerMap = shallowRef(new Map<number, MarkerVo>())

  // ============================== 代理方法 ==============================

  /**
   * @local 更新本地点位
   * - 已包含 version 比较逻辑
   */
  const updateLocal = (options: { updateList?: MarkerVo[]; deleteIds?: number[] }) => {
    const { updateList = [], deleteIds = [] } = options
    if (!updateList.length && !deleteIds.length) return
    const { length: deleteLength } = deleteIds
    for (let i = 0; i < deleteLength; i++) {
      const id = deleteIds[i]
      localMarkerMap.value.delete(id)
    }
    const { length: updateLength } = updateList
    for (let i = 0; i < updateLength; i++) {
      const marker = updateList[i]
      const { id, version = 0, linkageId } = marker
      const localMarker = localMarkerMap.value.get(id!)
      // 1. version 小于等于本地版本
      // 2. linkageId 等于本地 linkageId (点位关联变更不会影响 version)
      if (version <= (localMarker?.version ?? 0) && linkageId === localMarker?.linkageId) continue
      localMarkerMap.value.set(id!, marker)
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
      if (!data.updateList.length && !data.deleteIds.length) {
        context.message.value = [
          `[${context.tag.value}] `,
          '没有需要更新的数据，',
          `耗时 ${getCostTime(context.startTime.value).toFixed(1)}s`,
        ].join('')
        return
      }
      const { updateList, deleteIds } = data
      updateLocal(data)
      context.message.value = [
        `[${context.tag.value}] `,
        `更新(${updateList.length})，`,
        `删除(${deleteIds.length})，`,
        `耗时：${getCostTime(context.startTime.value).toFixed(1)}s`,
      ].join('')
    },

    commit: data => {
      if (!data || (!data.updateList.length && !data.deleteIds.length)) return
      const worker = new BulkPutWorker({ name: '点位更新线程' })
      worker.addEventListener('message', () => {
        worker.terminate()
      })
      worker.postMessage(<WorkerInput<number, MarkerVo>>{
        tableName: 'marker',
        clear: data.clear,
        bulkPutData: data.updateList,
        bulkDeleteKeys: data.deleteIds,
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
      const { snapshots } = await Apis.marker_doc.listMarkerDiffSnapshotByBinary()
      context.message.value = `[${context.tag.value}] 计算差异...`
      const { updateIds, deleteIds } = await diffMapMarkers(snapshots, localMarkerMap.value)
      context.message.value = `[${context.tag.value}] 拉取更新数据...`
      const updateList = await getMarkersByIds(updateIds)
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
