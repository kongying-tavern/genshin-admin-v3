import type { MarkerLinkageVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'
import { useMarkerLinkStore } from '@/stores'

export const useLinkDelete = () => {
  const markerLinkStore = useMarkerLinkStore()

  const { onSuccess, onError, ...rest } = useFetchHook({
    onRequest: async (link: MarkerLinkageVo) => {
      const { id } = link
      if (id === undefined) throw new Error('此关联的 id 为空')
      return await markerLinkStore.deleteMarkerLinkage([id])
    },
  })

  onSuccess(() => {
    ElMessage.success('删除成功')
  })

  onError(err => {
    ElMessage.error(`删除失败，原因为：${err.message}`)
  })

  return {
    onSuccess,
    onError,
    ...rest,
  }
}
