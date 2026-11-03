import type { PageListQueryParams, TypeManager } from '../config'
import type { TYPE_MANAGER_KEY_MAP, TypeManagerKeys, TypeManagerMap } from '../definitions'
import type { SysUserSmallVo } from '@/api/alova/globals'

import type { PaginationState } from '@/hooks'
import { useFetchHook } from '@/hooks'

export interface TypeListHookOptions {
  manager: ComputedRef<TypeManager>
  pagination: Ref<PaginationState>
  getParams: () => Omit<PageListQueryParams, 'current' | 'size'>
}

type ExtractListType<K extends TypeManagerKeys> = NonNullable<
  NonNullable<Awaited<ReturnType<TypeManagerMap[K]['list']>>['data']>['record']
>

export const useTypeList = <K extends keyof typeof TYPE_MANAGER_KEY_MAP>(
  options: TypeListHookOptions,
) => {
  const { manager, pagination, getParams } = options

  const params = computed(() => getParams())

  const typeList = shallowRef<ExtractListType<K>>([])
  const userMap = shallowRef<Record<string, SysUserSmallVo>>({})

  const {
    refresh: updateTypeList,
    onSuccess,
    ...rest
  } = useFetchHook({
    immediate: true,
    onRequest: () => {
      const { current, pageSize: size } = pagination.value
      const { list } = manager.value
      const { node } = params.value
      return list({ current, size, node })
    },
  })

  onSuccess(({ data: { record = [], total = 0 } = {}, users = {} }) => {
    typeList.value = record
    pagination.value.total = total
    userMap.value = users
  })

  return { typeList, userMap, updateTypeList, onSuccess, ...rest }
}
