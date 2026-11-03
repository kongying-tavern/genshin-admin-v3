import type { MarkerVo } from '@/api/alova/globals'
import Apis from '@/api/alova'
import { useFetchHook } from '@/hooks'
import { useSocketStore } from '@/stores'

export const useRemoteMarker = (
  markerId: MaybeRefOrGetter<number | undefined> | number | undefined,
) => {
  const socketStore = useSocketStore()

  const { data, loading, refresh } = useFetchHook({
    immediate: true,
    onRequest: async () => {
      const id = toValue(markerId)
      if (id === undefined) return
      const { data = [] } = await Apis.marker.listMarkerById({
        data: { markerIdList: [id] },
      })
      return data[0]
    },
  })

  isRef(markerId) && watch(markerId, () => refresh())

  const off1 = socketStore.appEvent.on('MarkerUpdated', remoteMarker => {
    if (remoteMarker.id !== toValue(markerId)) return
    data.value = remoteMarker as MarkerVo
  })

  const off2 = socketStore.appEvent.on('MarkerDeleted', remoteMarker => {
    if (remoteMarker.id !== toValue(markerId)) return
    data.value = {}
  })

  const off3 = socketStore.appEvent.on('MarkerTweaked', remoteMarkers => {
    const { length } = remoteMarkers
    for (let i = 0; i < length; i++) {
      const remoteMarker = remoteMarkers[i]
      if (remoteMarker.id !== toValue(markerId)) continue
      data.value = remoteMarker as MarkerVo
      break
    }
  })

  onBeforeUnmount(() => {
    off1()
    off2()
    off3()
  })

  return {
    data,
    loading,
  }
}
