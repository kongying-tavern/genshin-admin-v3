import type { SysRoleVo } from '@/api/alova/globals'
import { useFetchHook } from '@/hooks'

export const useRoleList = () => {
  const roleList = ref<SysRoleVo[]>([])

  const roleMap = computed(() =>
    roleList.value.reduce((map, role) => {
      map.set(role.id!, role)
      return map
    }, new Map<number, SysRoleVo>()),
  )

  const { onSuccess } = useFetchHook({
    immediate: true,
    onRequest: async () => {
      const res = await Apis.role.listRole()
      return res
    },
  })

  onSuccess(({ data = [] }) => {
    roleList.value = data.sort(
      ({ sort: sortA = 0 }: SysRoleVo, { sort: sortB = 0 }: SysRoleVo) => sortA - sortB,
    )
  })

  return { roleList, roleMap }
}
