import type { MarkerVo } from '@/api/alova/globals'
import type { GSMarkerInfo, MLRenderUnit, TempMarkerType } from '@/packages/map'
import type { useMarkerLinkStore } from '@/stores'
import { useFetchHook } from '@/hooks'

interface MarkerLinkHookOptions {
  markerIdMap: Map<number, MarkerVo>
  markerLinkStore: ReturnType<typeof useMarkerLinkStore>
  currentMarkerIdMap: ComputedRef<Map<number, GSMarkerInfo>>
  focusElements: Ref<Map<string, Set<unknown>>>
  staticMarkerIds: ComputedRef<Set<number>>
  setTempMarkers: (type: TempMarkerType, markers: MarkerVo[]) => void
}

/** 点位关联处理 hook */
export const useMarkerLink = (options: MarkerLinkHookOptions) => {
  const { markerIdMap, markerLinkStore, currentMarkerIdMap, focusElements, setTempMarkers } =
    options

  const {
    loading: markerLinkLoading,
    data: markerLinkRenderList,
    refresh: setMLRenderList,
  } = useFetchHook({
    initialValue: [],
    onRequest: async (list: MLRenderUnit[]) => {
      const tempMarkerIds = new Set<number>()
      list.forEach(({ source, target }) => {
        tempMarkerIds.add(source!)
        tempMarkerIds.add(target!)
      })
      const tempMarkers: MarkerVo[] = []
      tempMarkerIds.forEach(id => {
        const marker = markerIdMap.get(id)
        marker && tempMarkers.push(marker)
      })
      setTempMarkers('markerLink', tempMarkers)
      return list
    },
  })

  watch(
    () => focusElements.value.get('marker') as Set<number> | undefined,
    markerIds => {
      const list: MLRenderUnit[] = []

      if (!markerIds || !markerIds.size || markerIds.size > 1) {
        setTempMarkers('markerLink', [])
        return setMLRenderList(list)
      }

      const focusedMarkerId = markerIds.values().next().value
      if (focusedMarkerId === undefined) return setMLRenderList(list)

      const focusedMarker = currentMarkerIdMap.value.get(focusedMarkerId)
      if (!focusedMarker) return setMLRenderList(list)

      const { linkageId } = focusedMarker!

      markerLinkStore.markerLinkList.forEach(({ groupId, fromId, toId, linkAction }) => {
        if (groupId !== linkageId) return
        list.push({
          source: fromId!,
          target: toId!,
          type: linkAction! as MLRenderUnit['type'],
          key: `${Math.min(fromId!, toId!)}-${Math.max(fromId!, toId!)}-${linkAction! as MLRenderUnit['type']}`,
        })
      })

      setMLRenderList(list)
    },
  )

  return {
    markerLinkLoading,
    markerLinkRenderList,
    setMLRenderList,
  }
}
