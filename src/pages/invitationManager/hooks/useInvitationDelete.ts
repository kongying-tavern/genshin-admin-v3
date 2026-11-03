import type { SysUserInvitationVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export const useInvitationDelete = () => {
  const { onSuccess, onError, ...rest } = useFetchHook({
    onRequest: async ({ id: invitationId }: SysUserInvitationVo) => {
      if (invitationId === undefined) throw new Error('ID 为空')
      await Apis.invitation.deleteInvitation({
        pathParams: {
          invitationId,
        },
      })
      return invitationId
    },
  })

  onSuccess(() => {
    ElMessage.success('删除邀请码成功')
  })

  onError(err => {
    ElMessage.error(`删除邀请码失败，原因为：${err.message}`)
  })

  return {
    onSuccess,
    onError,
    ...rest,
  }
}
