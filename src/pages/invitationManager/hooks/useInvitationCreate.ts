import type { Awaitable } from '@vueuse/core'
import type { SysUserInvitationVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

interface InvitationCreateHookOptions {
  form: Ref<SysUserInvitationVo>
  validate: () => Awaitable<boolean | undefined>
}

export const useInvitationCreate = (options: InvitationCreateHookOptions) => {
  const { form, validate } = options

  const { onSuccess, onError, ...rest } = useFetchHook({
    initialValue: {},
    shallow: true,
    onRequest: async () => {
      const isValid = await validate()
      if (!isValid) throw new Error('校验未通过', { cause: 'validate' })
      return await Apis.invitation.updateInvitation({ data: form.value })
    },
  })

  onSuccess(() => {
    ElMessage.success('新增邀请码成功')
  })

  onError(err => {
    if (err.cause === 'validate') return
    ElMessage.error(`新增邀请码失败，原因为：${err.message}`)
  })

  return {
    onSuccess,
    onError,
    ...rest,
  }
}
