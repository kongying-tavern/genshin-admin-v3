import type { ShallowRef } from 'vue'
import type { MarkerLinkageVo } from '@/api/alova/globals'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'
import Apis from '@/api/alova'
import db from '@/database'
import { useManager } from '@/stores/hooks'
import { useSocketStore, useUserStore } from '.'
import { useMarkerStore } from './marker'
import { bulkWrite, getCostTime } from './utils'
import { fetchMarkersByIds } from './utils/fetchMarkersByIds'

interface ManagerContext {
  startTime: Ref<number>
  message: Ref<string>
  tag: Ref<string>
}

interface DiffData {
  updateList: MarkerLinkageVo[]
  deleteIds: number[]
  clear?: boolean
}

const getAllMarkerLinks = async (context: ManagerContext) => {
  context.message.value = `[${context.tag.value}] 获取关联数据...`
  const { data: linkGroups = {} } = await Apis.marker_link.getMarkerLinkageList({
    data: {
      isTraverse: true,
    },
  })

  const updateList: MarkerLinkageVo[] = []
  Object.values(linkGroups).forEach(links => {
    updateList.push(...links)
  })

  return { updateList, deleteIds: [], clear: true }
}

export const useMarkerLinkStore = defineStore('global-marker-link', () => {
  const userStore = useUserStore()
  const markerStore = useMarkerStore()

  // ============================== 内部状态 ==============================

  /** 原始点位关联 id 到点位关联对象的映射 */
  const localLinkMap = shallowRef(new Map<number, MarkerLinkageVo>())

  /** 关联数据更新版本号，每次 updateLocal 调用后递增，用于触发外部刷新 */
  const updateVersion = ref(0)

  /**
   * @local 更新本地点位关联
   */
  const updateLocal = (options: {
    updateList?: MarkerLinkageVo[]
    deleteIds?: number[]
    clear?: boolean
  }) => {
    const { updateList = [], deleteIds = [], clear = false } = options
    if (clear) localLinkMap.value = new Map<number, MarkerLinkageVo>()
    if (!updateList.length && !deleteIds.length && !clear) return
    const { length: deleteLength } = deleteIds
    for (let i = 0; i < deleteLength; i++) {
      const id = deleteIds[i]
      localLinkMap.value.delete(id)
    }
    const { length: updateLength } = updateList
    for (let i = 0; i < updateLength; i++) {
      const link = updateList[i]
      const { id, version = 0 } = link
      if (!id || version <= (localLinkMap.value.get(id)?.version ?? 0)) continue
      localLinkMap.value.set(id, link)
    }
    triggerRef(localLinkMap)
    updateVersion.value++
  }

  // ============================== 外部状态 ==============================
  const list = computed(() => [...localLinkMap.value.values()])

  const total = computed(() => list.value.length)

  const groupIdMap = computed(() =>
    list.value.reduce((map, link) => {
      if (!map.has(link.groupId!)) map.set(link.groupId!, [])
      map.get(link.groupId!)!.push(link)
      return map
    }, new Map<string, MarkerLinkageVo[]>()),
  )

  // ============================== 代理方法 ==============================

  /** @server 创建点位关联 */
  const linkMarker = async (links: MarkerLinkageVo[], deleteLinks: MarkerLinkageVo[] = []) => {
    if (!links.length) throw new Error('提交的关联项为空')

    // 1. 进行关联操作（只取必须的属性）
    const { data: newLinkageId } = await Apis.marker_link.linkMarker({
      data: links.map(link => ({
        fromId: link.fromId,
        toId: link.toId,
        linkAction: link.linkAction,
        path: link.path,
      })),
    })

    if (!newLinkageId) throw new Error('服务器未返回新关联组 id')

    // 2. 确认关联更新
    const { data: linkGroups = {} } = await Apis.marker_link.getMarkerLinkageList({
      data: { groupIds: [newLinkageId] },
    })

    const newLinks: MarkerLinkageVo[] = Object.values(linkGroups).flat(1)

    // 3. 收集旧关联影响的全部点位 id
    const oldEffectedMarkerIdSet = links.reduce((result, { fromId = -1, toId = -1 }) => {
      result.add(fromId)
      result.add(toId)
      return result
    }, new Set<number>())
    oldEffectedMarkerIdSet.delete(-1)
    deleteLinks?.forEach(({ fromId = -1, toId = -1 }) => {
      oldEffectedMarkerIdSet.add(fromId)
      oldEffectedMarkerIdSet.add(toId)
    })

    // 4. 收集新关联影响的全部点位 id
    const newEffectedMarkerIdSet = newLinks.reduce((result, { fromId = -1, toId = -1 }) => {
      result.add(fromId)
      result.add(toId)
      return result
    }, new Set<number>())
    newEffectedMarkerIdSet.delete(-1)

    // 5. 合并所有受影响的点位 id
    const allEffectedMarkerIds = Array.from(
      new Set([...oldEffectedMarkerIdSet, ...newEffectedMarkerIdSet]),
    )

    // 7. 更新本地数据
    // 7.1 更新本地关联表
    updateLocal({ updateList: newLinks })

    fetchMarkersByIds(allEffectedMarkerIds)
      .then(updatedMarkers => {
        markerStore.updateLocal({ updateList: updatedMarkers })
      })
      .catch(() => false)

    return newLinkageId
  }

  /** @server 删除点位关联 */
  const deleteMarkerLinkage = async (linkIds: number[]) => {
    if (!linkIds.length) throw new Error('删除的关联 id 列表为空')

    const { data = {} } = await Apis.marker_link.deleteMarkerLinkage({ data: { ids: linkIds } })
    const { groups: groupIds = [], markers: markerIds = [] } = data

    // 删除本地关联数据
    updateLocal({ deleteIds: linkIds })

    // 异步更新相关关联组和点位数据（非关键路径，失败不影响删除操作）
    Promise.all([
      (async () => {
        if (groupIds.length) {
          const { data = {} } = await Apis.marker_link.getMarkerLinkageList({
            data: { groupIds },
          })
          const links = Object.values(data).flat(1)
          updateLocal({ updateList: links })
        }
      })(),
      (async () => {
        if (markerIds.length) {
          const markers = await fetchMarkersByIds(markerIds)
          const markerStore = useMarkerStore()
          markerStore.updateLocal({ updateList: markers })
        }
      })(),
    ]).catch(() => {
      // 静默处理错误，不影响删除操作
    })

    return data
  }

  // ============================== 数据更新 ==============================

  const {
    context,
    isActive,
    error: managerError,
    nextUpdateTime,
    loading: updateLoading,
    progress,
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

    syncState: data => {
      if (!data) return
      if (!data.updateList.length && !data.deleteIds.length) {
        context.message.value = [
          `[${context.tag.value}] `,
          '检查完成，没有需要更新的数据，',
          `耗时 ${getCostTime(context.startTime.value).toFixed(1)}s`,
        ].join('')
        return
      }
      const { updateList, deleteIds } = data

      // 收集更新前受影响的点位 id（包括被删除关联涉及的点位）
      const effectedMarkerIds = new Set<number>()
      deleteIds.forEach(linkId => {
        const link = localLinkMap.value.get(linkId)
        if (link) {
          if (link.fromId) effectedMarkerIds.add(link.fromId)
          if (link.toId) effectedMarkerIds.add(link.toId)
        }
      })
      updateList.forEach(({ fromId, toId }) => {
        if (fromId) effectedMarkerIds.add(fromId)
        if (toId) effectedMarkerIds.add(toId)
      })

      updateLocal(data)

      // 异步更新受影响的点位数据
      if (effectedMarkerIds.size > 0) {
        fetchMarkersByIds(Array.from(effectedMarkerIds))
          .then(updatedMarkers => {
            markerStore.updateLocal({ updateList: updatedMarkers })
          })
          .catch(() => false)
      }

      context.message.value = [
        `[${context.tag.value}] `,
        `更新(${updateList.length})，`,
        `删除(${deleteIds.length})，`,
        `耗时：${getCostTime(context.startTime.value).toFixed(1)}s`,
      ].join('')
    },

    commit: async (data, context, task) => {
      if (!data || (!data.updateList.length && !data.deleteIds.length)) return
      const { error, message } = await bulkWrite<number, MarkerLinkageVo>({
        name: '点位关联更新线程',
        tableName: 'markerLink',
        clear: data.clear,
        bulkPutData: data.updateList,
        bulkDeleteKeys: data.deleteIds,
        onProgress: (loaded, total) => task.report({ loaded, total }),
      })
      if (error) context.message.value = `[${context.tag.value}] 关联写入失败：${message}`
    },

    init: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '初始化'
      context.message.value = `[${context.tag.value}] 拉取冷数据...`
      const localLinks = await db.markerLink.toArray()
      updateLocal({ updateList: localLinks })
      context.message.value = `[${context.tag.value}] 完毕: ${getCostTime(context.startTime.value).toFixed(1)}s`
    },

    diff: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '差异'
      context.message.value = '关联数据暂不支持差异更新'
      const data = await getAllMarkerLinks(context)
      return data
    },

    full: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '全量'
      const data = await getAllMarkerLinks(context)
      return data
    },
  })

  // ============================== 外部响应 ==============================

  const socketStore = useSocketStore()

  // 点位关联更新
  socketStore.appEvent.on('MarkerLinked', async markers => {
    // 从受影响点位中收集关联组 id
    const groupIds = [...new Set(markers.map(m => m.linkageId).filter(Boolean))] as string[]
    if (!groupIds.length) return

    // 获取最新的关联数据
    const { data: linkGroups = {} } = await Apis.marker_link.getMarkerLinkageList({
      data: { groupIds },
    })
    const links = Object.values(linkGroups).flat(1)
    updateLocal({ updateList: links })

    // 更新受影响的点位数据
    markerStore.updateLocal({ updateList: markers })
  })

  // 关联数据缓存刷新（全量重载）
  socketStore.appEvent.on('MarkerLinkageBinaryPurged', () => {
    update()
  })

  return {
    total,
    markerLinkList: list as Readonly<ShallowRef<MarkerLinkageVo[]>>,
    idMap: localLinkMap,
    groupIdMap,
    updateVersion,

    // 数据更新
    context,
    isActive,
    managerError,
    nextUpdateTime,
    updateLoading,
    progress,
    update,
    updateLocal,

    // 服务器操作
    linkMarker,
    deleteMarkerLinkage,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMarkerLinkStore, import.meta.hot))
}
