import type { Hash } from 'types/database'
import type { HashGroupMeta } from './utils'
import type { ItemTypeVo } from '@/api/alova/globals'
import { liveQuery } from 'dexie'
import { acceptHMRUpdate, defineStore } from 'pinia'
import db from '@/database'
import { useAccessStore, useUserStore } from '.'
import { useManager } from './hooks'
import { bulkWrite, createHashGroupMap } from './utils'

/** 本地物品类型数据 */
export const useItemTypeStore = defineStore('global-item-type', () => {
  const accessStore = useAccessStore()
  const userStore = useUserStore()

  // ==================== 内部状态 ====================
  const hashGroupMap = shallowRef(new Map<string, HashGroupMeta<Hash<ItemTypeVo>>>())

  // ==================== 外部状态 ====================
  const list = computed(() => {
    const result: ItemTypeVo[] = []
    hashGroupMap.value.forEach(({ list: scopeList }) => {
      scopeList.forEach(itemType => {
        if (!accessStore.checkHiddenFlag(itemType.hiddenFlag)) return
        result.push(itemType)
      })
    })
    return result.sort(({ sortIndex: ia = 0 }, { sortIndex: ib = 0 }) => ib - ia)
  })

  const total = computed(() => list.value.length)

  /** @deprecated 使用 `itemTypeIdMap` 代替 */
  const itemTypeMap = computed(
    () =>
      Object.fromEntries(list.value.map(itemType => [itemType.id as number, itemType])) as Record<
        string,
        ItemTypeVo
      >,
  )

  const idMap = computed(() =>
    list.value.reduce((seed, itemType) => {
      seed.set(itemType.id!, itemType)
      return seed
    }, new Map<number, ItemTypeVo>()),
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
      message.value = '读取本地物品类型数据...'
      const dbList = await db.itemType.toArray()
      hashGroupMap.value = createHashGroupMap(dbList)
      triggerRef(hashGroupMap)
    },

    full: async ({ updateCount, startTime, message }, task) => {
      startTime.value = Date.now()

      // 由于 itemType 接口暂无档案版，直接跳过 diff 进行覆盖更新
      message.value = '获取更新数据'
      const { data = [] } = await Apis.item_type.listItemType({})
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
      const { error, message: workerMessage } = await bulkWrite<number, Hash<ItemTypeVo>>({
        name: '物品类型更新线程',
        tableName: 'itemType',
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

  liveQuery(() => db.itemType.toArray()).subscribe(dbList => {
    hashGroupMap.value = createHashGroupMap(dbList)
    triggerRef(hashGroupMap)
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

    // 计算状态
    total,
    itemTypeList: list,
    itemTypeMap,
    itemTypeIdMap: idMap,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useItemTypeStore, import.meta.hot))
}
