import type { Hash } from 'types/database'
import type { HashGroupMeta } from './utils'
import type { AreaVo } from '@/api/alova/globals'
import { liveQuery } from 'dexie'
import { acceptHMRUpdate, defineStore } from 'pinia'
import db from '@/database'
import { useAccessStore, useUserStore } from '.'
import { useManager } from './hooks'
import { bulkWrite, createHashGroupMap } from './utils'

export interface AreaWithChildren extends AreaVo {
  children?: AreaWithChildren[]
}

export interface AreaWithExtraConfig extends AreaVo {
  extraConfig?: DTO.ExtraConfig
}

/** 本地地区数据 */
export const useAreaStore = defineStore('global-area', () => {
  const accessStore = useAccessStore()
  const userStore = useUserStore()

  // ==================== 内部状态 ====================
  const hashGroupMap = shallowRef(new Map<string, HashGroupMeta<Hash<AreaVo>>>())

  // ==================== 外部状态 ====================

  const list = computed(() => {
    const result: AreaVo[] = []
    hashGroupMap.value.forEach(({ list: scopeList }) => {
      scopeList.forEach(area => {
        if (!accessStore.checkHiddenFlag(area.hiddenFlag)) return
        result.push(area)
      })
    })
    return result.sort(({ sortIndex: ia = 0 }, { sortIndex: ib = 0 }) => ib - ia)
  })

  const total = computed(() => list.value.length)

  /** @deprecated 使用 `areaIdMap` 代替 */
  const areaMap = computed<Record<string, AreaVo>>(() =>
    Object.fromEntries(list.value.map(area => [area.id as number, area])),
  )

  const idMap = computed(() =>
    list.value.reduce((seed, area) => {
      seed.set(area.id!, area)
      return seed
    }, new Map<number, AreaVo>()),
  )

  const codeMap = computed(() =>
    list.value.reduce((seed, area) => {
      seed.set(area.code!, area)
      return seed
    }, new Map<string, AreaVo>()),
  )

  const parentAreaList = computed<AreaVo[]>(() => list.value.filter(area => !area.isFinal))
  const childrenAreaList = computed<AreaVo[]>(() => list.value.filter(area => area.isFinal))
  const areaTree = computed<AreaWithChildren[]>(() =>
    parentAreaList.value.map(parentArea => ({
      ...parentArea,
      children: childrenAreaList.value.filter(childArea => childArea.parentId === parentArea.id),
    })),
  )
  const childrenAreaParentMap = computed<Record<number, AreaVo[]>>(() =>
    Object.fromEntries(areaTree.value.map(area => [area.id!, area.children ?? []])),
  )

  // ==================== 数据更新 ====================

  const {
    context,
    isActive,
    error: managerError,
    nextUpdateTime,
    loading: updateLoading,
    progress,
    update,
  } = useManager({
    timeoutPull: {
      time: 20 * 60 * 1000,
      condition: () => userStore.info?.roleId !== undefined,
    },

    context: {
      updateCount: ref(0),
      startTime: ref(Date.now()),
      message: ref(''),
    },

    init: async ({ message }) => {
      message.value = '读取本地地区数据...'
      const dbList = await db.area.toArray()
      hashGroupMap.value = createHashGroupMap(dbList)
    },

    full: async ({ updateCount, startTime, message }, task) => {
      startTime.value = Date.now()

      // 由于 area 接口暂无档案版，直接跳过 diff 进行覆盖更新
      message.value = '获取更新数据'
      const { data = [] } = await Apis.area.listArea({
        data: {
          parentId: -1,
          isTraverse: true,
        },
      })
      task.report(0.6)

      message.value = '获取签名'
      const source = new TextEncoder().encode(JSON.stringify(data))
      const binaryHash = await crypto.subtle.digest('SHA-1', source)
      const hash = [...new Uint8Array(binaryHash)]
        .map(num => num.toString(16).padStart(2, '0'))
        .join('')
      task.report(0.9)

      const newData = data.map(newOne => {
        return { ...newOne, __hash: hash }
      })

      updateCount.value = newData.length

      return {
        bulkPutData: newData,
        bulkDeleteKeys: [],
        clear: true,
      }
    },

    commit: async (options, { message, startTime, updateCount }, task) => {
      if (!options) return
      message.value = '写入更新数据'
      const { error, message: workerMessage } = await bulkWrite<number, Hash<AreaVo>>({
        name: '地区更新线程',
        tableName: 'area',
        ...options,
        onProgress: (loaded, total) => task.report({ loaded, total }),
      })
      if (error) {
        message.value = workerMessage
        return
      }
      message.value = `更新 ${updateCount.value} 项, 耗时: ${((Date.now() - startTime.value) / 1000).toFixed(1)}s`
    },
  })

  liveQuery(() => db.area.toArray()).subscribe(dbList => {
    hashGroupMap.value = createHashGroupMap(dbList)
  })

  return {
    // 数据更新
    context,
    isActive,
    managerError,
    nextUpdateTime,
    updateLoading,
    progress,
    update,

    total,
    areaList: list,
    areaMap,
    areaIdMap: idMap,
    areaCodeMap: codeMap,
    parentAreaList,
    childrenAreaList,
    childrenAreaParentMap,
    areaTree,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAreaStore, import.meta.hot))
}
