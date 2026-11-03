import type { SysUserDeviceVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export const useUserDeviceEdit = (
  data: Ref<SysUserDeviceVo | undefined>,
  options: { loading: Ref<boolean> },
) => {
  const { loading } = options

  const {
    refresh: submit,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    loading,
    onRequest: async (status: SysUserDeviceVo['status']) => {
      const { id } = toValue(data) ?? {}
      if (id === undefined) throw new Error('设备 id 为空')

      await Apis.device.updateDevice({
        data: { id, status },
      })

      return status
    },
  })

  onSuccess(status => {
    if (!data.value) return
    data.value.status = status
  })

  onError(err => {
    ElMessage.error({
      message: `编辑用户设备状态失败，原因为：${err.message}`,
    })
  })

  return {
    submit,
    onSuccess,
    onError,
    ...rest,
  }
}
