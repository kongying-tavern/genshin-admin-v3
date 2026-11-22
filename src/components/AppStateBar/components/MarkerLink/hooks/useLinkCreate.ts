import type { ModifyLinkOptions } from '../shared'
import type { MarkerLinkMission } from '@/packages/map'
import { ElMessage } from 'element-plus'
import { useAccessStore } from '@/stores/access'
import { useMarkerLinkStore } from '@/stores/markerLink'
import { messageFrom } from '@/utils'

export const useLinkCreate = () => {
  const markerLinkStore = useMarkerLinkStore()
  const accessStore = useAccessStore()
  const pending = shallowRef<symbol>()
  const loading = computed(() => pending.value !== undefined)

  const submit = async (
    links: MarkerLinkMission[],
    modifyLinks: Map<string, ModifyLinkOptions>,
    onSuccess: () => void,
  ) => {
    if (loading.value || !accessStore.get('MARKER_LINK')) return
    const request = Symbol()
    pending.value = request
    const deleteLinks = [...modifyLinks.values()]
      .filter(group => group.isDelete)
      .map(group => group.raw)

    try {
      await markerLinkStore.linkMarker(links, deleteLinks)
    } catch (error) {
      if (pending.value === request) {
        pending.value = undefined
        ElMessage.error({ message: `关联操作失败，原因为：${messageFrom(error)}` })
      }
      return
    }
    if (pending.value !== request) return
    pending.value = undefined
    ElMessage.success({ message: '关联操作成功' })
    onSuccess()
  }

  const reset = () => {
    pending.value = undefined
  }

  return { loading, submit, reset }
}
