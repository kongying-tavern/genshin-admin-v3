import type { SysUserVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export const useUserKickOut = (form: Ref<SysUserVo>) => {
  const {
    refresh: submit,
    onError,
    onSuccess,
    ...rest
  } = useFetchHook({
    onRequest: async () => {
      const { id } = toValue(form)
      if (id === undefined) throw new Error('用户 id 为空')
      await Apis.user.kickOutUser({
        pathParams: {
          workId: id,
        },
      })
    },
  })

  onSuccess(() => {
    ElMessage.success({
      message: '注销用户成功',
    })
  })

  onError(err => {
    ElMessage.error({
      message: `注销用户失败，原因为：${err.message}`,
    })
  })

  return { submit, onSuccess, onError, ...rest }
}
