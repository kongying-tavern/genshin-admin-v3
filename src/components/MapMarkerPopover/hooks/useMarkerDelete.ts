import type { MarkerVo } from '@/api/alova/globals'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useFetchHook } from '@/hooks'
import { useMarkerStore } from '@/stores'

export const useMarkerDelete = () => {
  const markerStore = useMarkerStore()

  const {
    refresh: deleteMarker,
    loading,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async (markerId: number) => {
      await markerStore.deleteMarker(markerId)
    },
  })

  const confirmDeleteMarker = async (marker: MarkerVo | null) => {
    if (!marker) return
    ElMessageBox.confirm('确认删除点位', '警告', {
      type: 'warning',
      closeOnClickModal: false,
      closeOnPressEscape: false,
      closeOnHashChange: false,
      showClose: false,
      distinguishCancelAndClose: true,
      cancelButtonClass: 'el-button--primary el-button--danger',
      cancelButtonText: '确定',
      confirmButtonClass: 'el-button--info is-text',
      confirmButtonText: '取消',
      beforeClose: async (action, instance, done) => {
        if (loading.value) return
        if (action !== 'cancel') return done()
        instance.cancelButtonLoading = true
        await deleteMarker(marker.id!)
        instance.cancelButtonLoading = false
        done()
      },
    }).catch(() => false)
  }

  onSuccess(() => {
    ElMessage.success({
      message: '删除点位成功',
    })
  })

  onError(err =>
    ElMessage.error({
      message: `删除点位失败，原因为：${err.message}`,
    }),
  )

  return { confirmDeleteMarker, loading, ...rest }
}
