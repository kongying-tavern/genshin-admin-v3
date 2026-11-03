import type { ShallowRef } from 'vue'
import type { GSMarkerInfo } from '@/packages/map'
import { useMapStateStore } from '@/stores'

export const useMarkerMove = (markerInfo: ShallowRef<GSMarkerInfo | null>) => {
  const mapStateStore = useMapStateStore()

  const { data, isEnable, update } = mapStateStore.subscribeMission(
    'markerDragging',
    () => new Map(),
  )

  const draggingPosition = computed(() => {
    if (!markerInfo.value) return
    return data.value.get(markerInfo.value.id!)
  })

  const position = computed<DTO.Coordinate2D>(() => {
    if (!markerInfo.value) return [0, 0]
    return draggingPosition.value ?? markerInfo.value.render.position
  })

  const isMoving = computed({
    get: () => {
      if (!markerInfo.value) return false
      return draggingPosition.value !== undefined
    },
    set: isStartDrag => {
      if (!markerInfo.value) return false
      const newData = new Map(data.value)
      if (!isStartDrag) newData.delete(markerInfo.value.id!)
      else newData.set(markerInfo.value.id!, markerInfo.value.render.position)
      update(newData)
    },
  })

  return { isMoving, isEnable, position }
}
