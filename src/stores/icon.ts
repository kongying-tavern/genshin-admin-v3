import type { IconVo } from '@/api/alova/globals'
import type { WorkerInput } from '@/worker/idb.worker'
import { acceptHMRUpdate, defineStore } from 'pinia'
import BulkPutWorker from '@/worker/idb.worker?worker'
import { useUserStore } from '.'
import { useIconTextureRender, useManager, useMarkerTextureRender } from './hooks'
import { getCostTime } from './utils'

interface ManagerContext {
  startTime: Ref<number>
  message: Ref<string>
  tag: Ref<string>
}

interface DiffData {
  updateMap: Map<number, IconVo>
  deleteIds: number[]
  clear?: boolean
}

const getAllIcons = async (context: ManagerContext) => {
  context.message.value = '正在获取图标列表'
  const { data: { total = 0 } = {} } = await Apis.icon.listIcon({ data: { current: 1, size: 1 } })
  const missionTotal = Math.ceil(total / 500)
  const iconMap = new Map<number, IconVo>()
  let finished = 0
  await Promise.allSettled(
    Array.from({ length: missionTotal }).map(async (_, index) => {
      const { data: { record = [] } = {} } = await Apis.icon.listIcon({
        data: {
          current: index + 1,
          size: 500,
        },
      })
      const { length } = record
      for (let i = 0; i < length; i++) {
        const icon = record[i]
        iconMap.set(icon.id!, icon)
      }
      finished += 1
      context.message.value = `正在获取图标列表 (${finished}/${total})`
    }),
  )
  return iconMap
}

/** 本地图标数据 */
export const useIconStore = defineStore('global-icon', () => {
  const userStore = useUserStore()

  // ============================== 内部状态 ==============================

  const localIconMap = shallowRef(new Map<number, IconVo>())

  // ============================== 外部状态 ==============================
  const list = computed(() => [...localIconMap.value.values()])

  const total = computed(() => list.value.length)

  const {
    texture: iconTexture,
    textureUrl: iconTextureUrl,
    positionList: iconPositionList,
    coordMap: iconCoordMap,
    refresh: refreshIconSprite,
  } = useIconTextureRender()

  const { markerSpriteUrl, markerSpriteMapping } = useMarkerTextureRender({
    positionList: iconPositionList,
    iconTexture,
  })

  watch(list, data => refreshIconSprite(data))

  /**
   * @local 更新本地图标
   * - 已包含 version 比较逻辑
   */
  const updateLocal = (options: { updateMap?: Map<number, IconVo>; deleteIds?: number[] }) => {
    const { updateMap, deleteIds = [] } = options

    // 处理删除
    const { length: deleteLength } = deleteIds
    for (let i = 0; i < deleteLength; i++) {
      const id = deleteIds[i]
      localIconMap.value.delete(id)
    }

    // 处理更新
    updateMap?.forEach(icon => {
      const { id, version = 0 } = icon
      if (!id || version <= (localIconMap.value.get(id)?.version ?? 0)) return
      localIconMap.value.set(id, icon)
    })

    triggerRef(localIconMap)
  }

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
      if (!data.updateMap.size && !data.deleteIds.length) {
        context.message.value = [
          `[${context.tag.value}] `,
          '没有需要更新的数据，',
          `耗时 ${getCostTime(context.startTime.value).toFixed(1)}s`,
        ].join('')
        return
      }
      if (data.clear) localIconMap.value = new Map<number, IconVo>()
      const { updateMap, deleteIds } = data
      updateLocal(data)
      context.message.value = [
        `[${context.tag.value}] `,
        `更新(${updateMap.size})，`,
        `删除(${deleteIds.length})，`,
        `耗时：${getCostTime(context.startTime.value).toFixed(1)}s`,
      ].join('')
    },

    commit: data => {
      if (!data || (!data.updateMap.size && !data.deleteIds.length)) return
      const worker = new BulkPutWorker({ name: '图标更新线程' })
      worker.addEventListener('message', () => {
        worker.terminate()
      })
      worker.postMessage(<WorkerInput<number, IconVo>>{
        tableName: 'icon',
        clear: data.clear,
        bulkPutData: Array.from(data.updateMap.values()),
        bulkDeleteKeys: data.deleteIds,
      })
    },

    init: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '初始化'
      context.message.value = `[${context.tag.value}] 拉取最新数据...`
      const updateMap = await getAllIcons(context)
      updateLocal({ updateMap })
      context.message.value = `[${context.tag.value}] 完毕: ${getCostTime(context.startTime.value).toFixed(1)}s`
    },

    diff: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '差异'
      context.message.value = '图标数据暂不支持差异更新'
      // no diff for items
    },

    full: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '全量'
      const updateMap = await getAllIcons(context)
      return { updateMap, deleteIds: [] }
    },
  })

  /** @server 创建图标（封装 Apis.icon.createIcon 与本地更新逻辑） */
  const createIcon = async (iconForm: IconVo) => {
    const { data: id } = await Apis.icon.createIcon({ data: iconForm })
    if (!id) throw new Error('新增失败，返回 id 为空')
    try {
      const {
        data = {},
        error,
        message: getMsg = '',
      } = await Apis.icon.getIcon({
        pathParams: { iconId: id },
      })
      if (error) throw new Error(getMsg)
      updateLocal({ updateMap: new Map([[data.id!, data]]) })
    } catch (error) {
      console.warn('createIcon 本地更新失败', error)
    }
  }

  /** @server 更新图标（封装 Apis.icon.updateIcon 与本地更新逻辑） */
  const updateIcon = async (iconForm: IconVo) => {
    if (!iconForm.id) throw new Error('图标 id 为空')
    await Apis.icon.updateIcon({ data: iconForm })
    try {
      const {
        data = {},
        error,
        message: getMsg = '',
      } = await Apis.icon.getIcon({
        pathParams: { iconId: iconForm.id },
      })
      if (error) throw new Error(getMsg)
      updateLocal({ updateMap: new Map([[data.id!, data]]) })
    } catch (error) {
      console.warn('updateIcon 本地更新失败', error)
    }
  }

  /** @server 删除图标（封装 Apis.icon.deleteIcon 与本地更新逻辑） */
  const deleteIcon = async (iconId: number) => {
    const { data: isSuccess, message } = await Apis.icon.deleteIcon({ pathParams: { iconId } })
    if (!isSuccess) throw new Error(message)
    updateLocal({ deleteIds: [iconId] })
  }

  // ============================== 外部响应 ==============================

  return {
    // 数据更新
    context,
    isActive,
    managerError,
    nextUpdateTime,
    updateLoading,
    update,

    /** 图标纹理 */
    iconTexture,
    /** 图标纹理本地地址 */
    iconTextureUrl,
    /** 图标 id 到纹理坐标映射 */
    iconCoordMap,

    // marker resource
    markerSpriteUrl,
    markerSpriteMapping,

    // 本地操作
    updateLocal,

    // 服务器操作
    createIcon,
    updateIcon,
    deleteIcon,

    // 计算状态
    iconList: list,
    total,
    /** 与 markerStore 一致，直接暴露本地 id -> icon 映射表 */
    idMap: localIconMap,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useIconStore, import.meta.hot))
}
