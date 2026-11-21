import type { IconVo } from '@/api/alova/globals'
import type { ManagerTask } from './hooks'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useUserStore } from '.'
import { useIconTextureRender, useManager, useMarkerTextureRender } from './hooks'
import { bulkWrite, getCostTime } from './utils'

/** 图标分页查询的页大小 */
const PAGE_SIZE = 500

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

const getAllIcons = async (context: ManagerContext, task: ManagerTask) => {
  context.message.value = '正在获取图标列表'
  const { data: { total = 0 } = {} } = await Apis.icon.listIcon({
    data: { current: 1, size: 1 },
  })
  const missionTotal = Math.ceil(total / PAGE_SIZE)
  if (!missionTotal) return new Map<number, IconVo>()
  const iconMap = new Map<number, IconVo>()
  let finished = 0
  await Promise.allSettled(
    Array.from({ length: missionTotal }).map(async (_, index) => {
      const { data: { record = [] } = {} } = await Apis.icon.listIcon({
        data: {
          current: index + 1,
          size: PAGE_SIZE,
        },
      })
      const { length } = record
      for (let i = 0; i < length; i++) {
        const icon = record[i]
        iconMap.set(icon.id!, icon)
      }
      finished += 1
      task.report({ loaded: finished, total: missionTotal })
      context.message.value = `正在获取图标列表 (${finished}/${missionTotal})`
    }),
  )
  return iconMap
}

/** 本地图标数据 */
export const useIconStore = defineStore('global-icon', () => {
  const userStore = useUserStore()

  // ============================== 内部状态 ==============================

  const localIconMap = shallowRef(new Map<number, IconVo>())
  const iconsWithConfirmedTypes = new WeakSet<IconVo>()

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
    let changed = false

    // 处理删除
    const { length: deleteLength } = deleteIds
    for (let i = 0; i < deleteLength; i++) {
      const id = deleteIds[i]
      if (localIconMap.value.delete(id)) changed = true
    }

    // 处理更新
    updateMap?.forEach(icon => {
      const { id, version = 0 } = icon
      if (!id || version <= (localIconMap.value.get(id)?.version ?? 0)) return
      localIconMap.value.set(id, icon)
      changed = true
    })

    if (changed) triggerRef(localIconMap)
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

    syncState: async (data, context) => {
      if (!data) return
      if (!data.updateMap.size && !data.deleteIds.length) {
        context.message.value = [
          `[${context.tag.value}] `,
          '检查完成，没有需要更新的数据，',
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

    commit: async (data, context, task) => {
      if (!data || (!data.updateMap.size && !data.deleteIds.length)) return
      const { error, message } = await bulkWrite<number, IconVo>({
        name: '图标更新线程',
        tableName: 'icon',
        clear: data.clear,
        bulkPutData: Array.from(data.updateMap.values()),
        bulkDeleteKeys: data.deleteIds,
        onProgress: (loaded, total) => task.report({ loaded, total }),
      })
      if (error) context.message.value = `[${context.tag.value}] 图标写入失败：${message}`
    },

    init: async (context, task) => {
      context.startTime.value = Date.now()
      context.tag.value = '初始化'
      context.message.value = `[${context.tag.value}] 拉取最新数据...`
      const updateMap = await getAllIcons(context, task)
      updateLocal({ updateMap })
      context.message.value = `[${context.tag.value}] 完毕: ${getCostTime(context.startTime.value).toFixed(1)}s`
    },

    diff: async context => {
      context.startTime.value = Date.now()
      context.tag.value = '差异'
      context.message.value = '图标数据暂不支持差异更新'
      // no diff for items
    },

    full: async (context, task) => {
      context.startTime.value = Date.now()
      context.tag.value = '全量'
      const updateMap = await getAllIcons(context, task)
      return { updateMap, deleteIds: [] }
    },
  })

  /** 用列表接口回读单个图标。同一版本的已确认分类优先于列表回读。 */
  const refreshIcon = async (
    iconId: number,
    confirmedTypes?: { version: number; typeIdList: number[] },
  ) => {
    const { data } = await Apis.icon.listIcon({
      data: { iconIdList: [iconId], current: 1, size: 1 },
    })
    const icon = data?.record?.find(({ id }) => id === iconId)
    if (!icon) throw new Error('未找到图标')

    const local = localIconMap.value.get(iconId)
    if (local && (local.version ?? 0) > (icon.version ?? 0)) return local

    // 列表可能在写入后返回新版本，却漏掉该版本的分类。
    if (confirmedTypes && icon.version === confirmedTypes.version) {
      const updated = { ...icon, typeIdList: confirmedTypes.typeIdList }
      iconsWithConfirmedTypes.add(updated)
      localIconMap.value.set(iconId, updated)
      triggerRef(localIconMap)
      return updated
    }
    if (local && local.version === icon.version && iconsWithConfirmedTypes.has(local)) {
      return local
    }

    updateLocal({ updateMap: new Map([[iconId, icon]]) })
    return icon
  }

  /** @server 创建图标（封装 Apis.icon.createIcon 与本地更新逻辑） */
  const createIcon = async (iconForm: IconVo) => {
    const { data: id } = await Apis.icon.createIcon({ data: iconForm })
    if (!id) throw new Error('新增失败，返回 id 为空')
    try {
      await refreshIcon(id)
    } catch (error) {
      console.warn('createIcon 本地更新失败', error)
    }
  }

  /** @server 更新图标（封装 Apis.icon.updateIcon 与本地更新逻辑） */
  const updateIcon = async (iconForm: IconVo) => {
    const { id, version, typeIdList } = iconForm
    if (!id) throw new Error('图标 id 为空')
    const submittedTypes = typeIdList?.slice()
    const { data, message } = await Apis.icon.updateIcon({
      data: { ...iconForm, typeIdList: submittedTypes },
    })
    if (!data) throw new Error(message || '更新图标失败')

    const confirmedTypes =
      version == null || submittedTypes === undefined
        ? undefined
        : { version: version + 1, typeIdList: submittedTypes }
    try {
      const updated = await refreshIcon(id, confirmedTypes)
      if (version != null && (updated.version ?? 0) <= version) {
        throw new Error('图标回读版本尚未更新')
      }
      return updated
    } catch (error) {
      console.warn('updateIcon 本地更新失败', error)
    }
  }

  const addIconToCategory = async (id: number, typeId: number) => {
    const { typeIdList, version, tag, description, url, urlVariants } = await refreshIcon(id)
    if (typeIdList?.includes(typeId)) return { added: false, synced: true }

    const updated = await updateIcon({
      id,
      version,
      tag,
      description,
      url,
      urlVariants,
      typeIdList: [...(typeIdList ?? []), typeId],
    })
    return { added: true, synced: updated !== undefined }
  }

  /** 分类接口确认删除后清理内存列表中的引用，避免后续编辑带上已删除的分类。 */
  const removeDeletedCategory = (typeId: number) => {
    let changed = false
    for (const [id, icon] of localIconMap.value) {
      if (!icon.typeIdList?.includes(typeId)) continue
      const updated = {
        ...icon,
        typeIdList: icon.typeIdList.filter(id => id !== typeId),
      }
      if (iconsWithConfirmedTypes.has(icon)) iconsWithConfirmedTypes.add(updated)
      localIconMap.value.set(id, updated)
      changed = true
    }
    if (changed) triggerRef(localIconMap)
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
    progress,
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
    removeDeletedCategory,

    // 服务器操作
    createIcon,
    updateIcon,
    deleteIcon,
    addIconToCategory,

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
