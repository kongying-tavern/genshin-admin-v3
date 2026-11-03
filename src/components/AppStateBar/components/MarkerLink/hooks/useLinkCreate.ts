import type { ModifyLinkOptions } from '../shared'
import type { MarkerLinkageVo } from '@/api/alova/globals'
import type { MarkerLinkMission } from '@/packages/map'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'
import { useMarkerLinkStore } from '@/stores'

export const useLinkCreate = () => {
  const markerLinkStore = useMarkerLinkStore()

  const { onSuccess, onError, ...rest } = useFetchHook({
    onRequest: async (links: MarkerLinkMission[], modifyLinks: Map<string, ModifyLinkOptions>) => {
      const deleteLinks: MarkerLinkageVo[] = []
      modifyLinks.forEach(group => {
        if (!group.isDelete) return
        deleteLinks.push(group.raw)
      })
      await markerLinkStore.linkMarker(links, deleteLinks)
    },
  })

  onSuccess(() => {
    ElMessage.success({
      message: '关联操作成功',
    })
  })

  onError(err => {
    ElMessage.error({
      message: `关联操作失败，原因为：${err.message}`,
    })
  })

  return { onSuccess, ...rest }
}
