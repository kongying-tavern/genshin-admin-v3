import type { SysUserPasswordUpdateVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export const usePasswordUpdate = (
  form: Ref<SysUserPasswordUpdateVo>,
  options: { loading: Ref<boolean> },
) => {
  const { loading } = options

  const {
    refresh: submit,
    onError,
    onSuccess,
    ...rest
  } = useFetchHook({
    loading,
    onRequest: async () => {
      const { userId, oldPassword = '', password = '' } = toValue(form)

      if (userId === undefined) throw new Error('表单信息中用户 id 为空')

      await Apis.user.updateUserPasswordByAdmin({
        data: {
          userId,
          password,
          oldPassword,
        },
      })
    },
  })

  onSuccess(() => {
    ElMessage.success({
      message: '密码修改成功',
    })
  })

  onError(err => {
    ElMessage.error({
      message: `密码修改失败，原因为：${err.message}`,
    })
  })

  return { submit, onSuccess, onError, ...rest }
}
