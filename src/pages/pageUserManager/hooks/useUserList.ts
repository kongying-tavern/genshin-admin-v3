import type { SysUserSearchVo, SysUserVo } from '@/api/alova/globals'
import type { PaginationState } from '@/hooks/usePagination'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useFetchHook } from '@/hooks'

interface UserListHookOptions {
  pagination: Ref<PaginationState>
  sortInfo: Ref<{ key: string; type: string }>
}

type SearchKey = keyof Pick<SysUserSearchVo, 'nickname' | 'username'>

/** 列表数据与核心操作封装 */
export const useUserList = (options: UserListHookOptions) => {
  const { pagination, sortInfo } = options

  const userList = ref<SysUserVo[]>([])

  // 搜索
  const filterKey = ref<SearchKey>('nickname')
  const filterValue = ref('')
  const filterRoleIds = ref<number[]>([])

  const {
    refresh: updateUserList,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    immediate: true,
    onRequest: async () => {
      const { current, pageSize: size } = toValue(pagination)
      const { key: sortKey, type: sortType } = toValue(sortInfo)
      const data: SysUserSearchVo = {
        current,
        size,
        sort: [`${sortKey}${sortType}`],
      }
      data[filterKey.value] = filterValue.value
      if (filterRoleIds.value.length) data.roleIds = filterRoleIds.value
      const res = await Apis.user.getUserList({ data })
      return res
    },
  })

  const resetCurrent = async () => {
    pagination.value.current = 1
    await updateUserList()
  }

  onSuccess(({ data: { record = [], total = 0 } = {} }) => {
    userList.value = record
    pagination.value.total = total
  })

  onError(err => {
    userList.value = []
    ElMessage.error({
      message: `获取结果失败，原因为: ${err.message}`,
    })
  })

  return {
    userList,
    filterKey,
    filterValue,
    filterRoleIds,
    updateUserList,
    resetCurrent,
    onError,
    ...rest,
  }
}
