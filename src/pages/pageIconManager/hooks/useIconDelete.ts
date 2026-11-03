import type { IconVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'
import { useIconStore } from '@/stores/icon'

export const useIconDelete = () => {
  const iconStore = useIconStore()

  const {
    refresh: deleteIcon,
    loading,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async (icon: IconVo) => {
      await iconStore.deleteIcon(icon.id!)
      return icon
    },
  })

  onSuccess(() =>
    ElMessage.success({
      message: '删除成功',
    }),
  )

  onError(err =>
    ElMessage.error({
      message: `删除图标失败，原因为：${err.message}`,
    }),
  )

  return { loading, deleteIcon, onSuccess, ...rest }
}
