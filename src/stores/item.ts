import type { ItemVo } from '@/api/alova/globals'
import type { ManagerTask } from './hooks'
import { Box } from '@element-plus/icons-vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useAccessStore, useSocketStore, useUserStore } from '.'
import { useManager } from './hooks'
import { bulkWrite, getCostTime } from './utils'

interface ManagerContext {
  startTime: Ref<number>
  message: Ref<string>
  tag: Ref<string>
}

interface DiffData {
  updateList: ItemVo[]
  deleteIds: number[]
  clear?: boolean
}

const getAllItems = async (context: ManagerContext, task: ManagerTask) => {
  context.message.value = '正在获取区域列表'
  const areaIds = await Apis.area.listArea({
    data: { isTraverse: true },
    transform: res => (res.data ?? []).filter(area => area.parentId !== -1).map(({ id }) => id!),
  })
  context.message.value = '正在准备获取物品列表'
  const itemMap = new Map<number, ItemVo>()
  const total = areaIds.length
  let finished = 0
  await Promise.allSettled(
    areaIds.map(async areaId => {
      const { data: { record = [] } = {} } = await Apis.item.listItemIdByType({
        data: {
          areaIdList: [areaId],
          current: 1,
          size: 500,
        },
      })
      const { length } = record
      for (let i = 0; i < length; i++) {
        const item = record[i]
        itemMap.set(item.id!, item)
      }
      finished += 1
      task.report({ loaded: finished, total })
      context.message.value = `正在获取物品列表 (${finished}/${total})`
    }),
  )
  return Array.from(itemMap.values())
}

/** 本地物品数据 */
export const useItemStore = defineStore('global-item', () => {
  const accessStore = useAccessStore()
  const socketStore = useSocketStore()
  const userStore = useUserStore()

  // ============================== 内部状态 ==============================

  /** 物品 id 索引表 */
  const localItemMap = shallowRef(new Map<number, ItemVo>())

  // ============================== 代理方法 ==============================

  /**
   * @local 更新本地物品
   * - 已包含 version 比较逻辑
   */
  const updateLocal = (options: { updateList?: ItemVo[]; deleteIds?: number[] }) => {
    const { updateList = [], deleteIds = [] } = options
    if (!updateList.length && !deleteIds.length) return
    const { length: deleteLength } = deleteIds
    for (let i = 0; i < deleteLength; i++) {
      const id = deleteIds[i]
      localItemMap.value.delete(id)
    }
    const { length: updateLength } = updateList
    for (let i = 0; i < updateLength; i++) {
      const item = updateList[i]
      const { id = 0, version = 0 } = item
      const localItem = localItemMap.value.get(id!)
      if (version < (localItem?.version ?? 0)) continue
      localItemMap.value.set(id, item)
    }
    triggerRef(localItemMap)
  }

  /** @server */
  const createItem = async (itemForm: ItemVo) => {
    const { data: itemId } = await Apis.item.createItem({ data: itemForm })
    if (!itemId) throw new Error('服务器未返回新物品 id')
    Apis.item.listItemById({ data: [itemId] }).then(({ data: [item] = [] }) => {
      if (!item) return
      updateLocal({ updateList: [item] })
    })
  }

  /** @server */
  const updateItem = async (itemForm: ItemVo) => {
    if (!itemForm.id) throw new Error('物品 id 为空')
    const { data: ids = [] } = await Apis.item.updateItem({
      pathParams: { editSame: 0 },
      data: [itemForm],
    })
    Apis.item
      .listItemById({
        data: ids,
      })
      .then(({ data: [item] = [] }) => {
        if (!item) return
        updateLocal({ updateList: [item] })
      })
  }

  const deleteItem = async (itemId: number) => {
    const { data: isSuccess, message } = await Apis.item.deleteItem({
      pathParams: { itemId },
    })
    if (!isSuccess) throw new Error(message)
    updateLocal({ deleteIds: [itemId] })
  }

  // ============================== 外部状态 ==============================

  const list = computed(() => {
    const res: ItemVo[] = []
    localItemMap.value.forEach(item => {
      if (!accessStore.checkHiddenFlag(item.hiddenFlag)) return
      res.push(item)
    })
    return res.sort(({ sortIndex: ia = 0 }, { sortIndex: ib = 0 }) => ib - ia)
  })

  const total = computed(() => list.value.length)

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

    syncState: async (data, context) => {
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
      updateLocal(data)
      context.message.value = [
        `[${context.tag.value}] `,
        `更新(${updateList.length})，`,
        `删除(${deleteIds.length})，`,
        `耗时：${getCostTime(context.startTime.value).toFixed(1)}s`,
      ].join('')
    },

    commit: async (data, context, task) => {
      if (!data || (!data.updateList.length && !data.deleteIds.length)) return
      const { error, message } = await bulkWrite<number, ItemVo>({
        name: '物品更新线程',
        tableName: 'item',
        clear: data.clear,
        bulkPutData: data.updateList,
        bulkDeleteKeys: data.deleteIds,
        onProgress: (loaded, total) => task.report({ loaded, total }),
      })
      if (error) context.message.value = `[${context.tag.value}] 物品写入失败：${message}`
    },

    init: async (context, task) => {
      context.startTime.value = Date.now()
      context.tag.value = '初始化'
      context.message.value = `[${context.tag.value}] 拉取最新数据...`
      const localItems = await getAllItems(context, task)
      updateLocal({ updateList: localItems })
      context.message.value = `[${context.tag.value}] 完毕: ${getCostTime(context.startTime.value).toFixed(1)}s`
    },

    diff: async (context, task) => {
      context.startTime.value = Date.now()
      context.tag.value = '差异'
      context.message.value = '物品数据暂不支持差异更新'
      const updateList = await getAllItems(context, task)
      return { updateList, deleteIds: [] }
    },

    full: async (context, task) => {
      context.startTime.value = Date.now()
      context.tag.value = '全量'
      const updateList = await getAllItems(context, task)
      return { updateList, deleteIds: [] }
    },
  })

  // ============================== 外部响应 ==============================
  socketStore.appEvent.on('ItemAdded', async (itemInfo, userInfo) => {
    const { id, name, updaterId } = itemInfo
    if (!id) return
    const { username = `(uid: ${updaterId})`, nickname } = userInfo
    localItemMap.value.set(id, itemInfo)
    triggerRef(localItemMap)
    socketStore.notice('ItemAdded', {
      message: `${nickname ?? username} 添加了物品 ${name} (id:${id})`,
      icon: Box,
      customClass: 'text-[var(--el-color-success)]',
    })
  })

  socketStore.appEvent.on('ItemUpdated', async (itemInfo, userInfo) => {
    const { id, name, updaterId } = itemInfo
    if (!id) return
    const { username = `(uid: ${updaterId})`, nickname } = userInfo
    localItemMap.value.set(id, itemInfo)
    triggerRef(localItemMap)
    socketStore.notice('ItemUpdated', {
      message: `${nickname ?? username} 更新了物品 ${name} (id:${id})`,
      icon: Box,
      customClass: 'text-[var(--el-color-primary)]',
    })
  })

  socketStore.appEvent.on('ItemDeleted', async (itemInfo, userInfo) => {
    const { id, name, creatorId } = itemInfo
    const { username = `(uid: ${creatorId})`, nickname } = userInfo
    localItemMap.value.delete(id!)
    triggerRef(localItemMap)
    socketStore.notice('ItemDeleted', {
      message: `${nickname ?? username} 删除了物品 ${name} (id:${id})`,
      icon: Box,
      customClass: 'text-[var(--el-color-danger)]',
    })
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
    createItem,
    updateItem,
    deleteItem,

    // 计算状态
    itemList: list,
    total,
    idMap: localItemMap,
    itemIdMap: localItemMap,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useItemStore, import.meta.hot))
}
