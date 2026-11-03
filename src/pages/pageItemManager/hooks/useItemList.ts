import type { Ref } from 'vue'
import type { ItemVo, SysUserSmallVo } from '@/api/alova/globals'
import type { PaginationState } from '@/hooks'
import { ElMessage } from 'element-plus'
import Apis from '@/api/alova'
import { useFetchHook } from '@/hooks'

export interface ItemQueryForm {
  name?: string
  areaId?: number
  itemTypeId?: number
  specialFlag?: number
}

export interface ItemHookOptions {
  getParams: () => ItemQueryForm
  pagination: Ref<PaginationState>
}

/** 物品列表与相关操作方法 */
export const useItemList = (options: ItemHookOptions) => {
  const { pagination, getParams } = options

  const itemList = ref<ItemVo[]>([]) as Ref<ItemVo[]>
  const userMap = ref<Record<string, SysUserSmallVo>>({})

  /** 共享的物品id → 物品对象映射表 */
  const itemMap = computed(() =>
    itemList.value.reduce(
      (seed, item) => {
        item.id !== undefined && (seed[item.id] = item)
        return seed
      },
      {} as Record<number, ItemVo>,
    ),
  )

  const {
    refresh: updateItemList,
    onSuccess,
    onError,
    loading,
    ...rest
  } = useFetchHook({
    immediate: true,
    onRequest: async () => {
      const { current, pageSize: size } = pagination.value
      const { areaId, itemTypeId, name = '', specialFlag } = getParams()
      return Apis.item.listItemIdByType({
        data: {
          current,
          size,
          sort: ['sortIndex-'],
          areaIdList: !areaId ? [] : [areaId],
          typeIdList: !itemTypeId ? [] : [itemTypeId],
          name,
          specialFlag,
        },
      })
    },
  })

  const resetCurrent = async () => {
    pagination.value.current = 1
    await updateItemList()
  }

  onSuccess(({ data: { record = [], total = 0 } = {}, users = {} }) => {
    itemList.value = record
    pagination.value.total = total
    userMap.value = users
  })

  onError(err => {
    itemList.value = []
    ElMessage.error({
      message: `获取结果失败，原因为: ${err.message}`,
    })
  })

  return {
    itemList,
    itemMap,
    loading,
    userMap,
    updateItemList,
    resetCurrent,
    onSuccess,
    onError,
    ...rest,
  }
}
