import type { IconSearchVo, IconVo, SysUserSmallVo } from '@/api/alova/globals'
import type { PaginationState } from '@/hooks'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export interface IconListHookOptions {
  pagination: Ref<PaginationState>
  getParams: () => Omit<IconSearchVo, 'current' | 'size'>
}

/** 图标列表 hook */
export const useIconList = (options: IconListHookOptions) => {
  const { pagination, getParams } = options

  const iconList = ref<IconVo[]>([])
  const userMap = ref<Record<string, SysUserSmallVo>>({})

  const {
    refresh: updateIconList,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    immediate: true,
    onRequest: () =>
      Apis.icon.listIcon({
        data: {
          ...getParams(),
          current: pagination.value.current,
          size: pagination.value.pageSize,
        },
      }),
  })

  const updateIconListWithResetCurrent = async () => {
    pagination.value.current = 1
    await updateIconList()
  }

  onSuccess(({ data: { record = [], total = 0 } = {}, users = {} }) => {
    iconList.value = record
    userMap.value = users
    pagination.value.total = total
  })

  onError(err =>
    ElMessage.error({
      message: `更新图标列表失败，原因为：${err.message}`,
    }),
  )

  return { iconList, userMap, updateIconList, updateIconListWithResetCurrent, onSuccess, ...rest }
}
