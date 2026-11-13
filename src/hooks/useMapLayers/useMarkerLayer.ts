import type { GSMarkerInfo } from '@/packages/map'
import { useSubscription } from '@vueuse/rxjs'
import { filter } from 'rxjs'
import { GSMarkerLayer } from '@/packages/map'
import { MapSubject } from '@/shared'
import { useArchiveStore, useIconStore, useMapStateStore, usePreferenceStore } from '@/stores'
import { createDataDiff } from '@/stores/utils'

export const useMarkerLayer = () => {
  const archiveStore = useArchiveStore()
  const iconStore = useIconStore()
  const mapStateStore = useMapStateStore()
  const preferenceStore = usePreferenceStore()

  /**
   * 点位数据的区间更新描述
   *
   * 分片加载时数据只是不断向后追加，此时只需上传新增行的顶点属性；
   * 一旦出现删除或重排会自动退回全量更新，由 deck.gl 兜底。
   */
  const markerDataDiff = createDataDiff({
    // 临时点位（关联高亮 / 批量操作预览）总是排在正式点位之后，不参与比较
    getTailCount: () => mapStateStore.tempMarkers.length,
  })

  const { data: rewritePositions } = mapStateStore.subscribeMission(
    'markerDragging',
    () => new Map(),
  )

  const { isProcessing } = mapStateStore.subscribeMission('markerMultiSelect', () => '')

  // 点位 focus
  useSubscription(
    MapSubject.click
      .pipe(
        filter(({ info, event }) =>
          [!isProcessing.value, info.layer instanceof GSMarkerLayer, event.leftButton].every(
            Boolean,
          ),
        ),
      )
      .subscribe(({ info }) => {
        const key = GSMarkerLayer.layerName
        if (!info.object) {
          mapStateStore.interaction.removeFocus(key)
          return
        }
        const markerInfo = info.object as GSMarkerInfo
        const oldHover = mapStateStore.interaction.focusElements.get(key) as Set<number> | undefined
        if (oldHover?.has(markerInfo.id!)) return
        mapStateStore.interaction.setFocus(key, new Set([markerInfo.id!]))
      }),
  )

  // 点位 hover
  useSubscription(
    MapSubject.hover
      .pipe(filter(({ info }) => info.layer instanceof GSMarkerLayer))
      .subscribe(({ info }) => {
        const key = GSMarkerLayer.layerName
        if (!info.object) {
          mapStateStore.interaction.removeHover(key)
          return
        }
        const markerInfo = info.object as GSMarkerInfo
        const oldHover = mapStateStore.interaction.hoverElements.get(key) as Set<number> | undefined
        if (oldHover?.has(markerInfo.id!)) return
        mapStateStore.interaction.setHover(key, new Set([markerInfo.id!]))
      }),
  )

  const markerLayer = computed<GSMarkerLayer | undefined>(() => {
    if (!iconStore.markerSpriteUrl) return

    const key = GSMarkerLayer.layerName
    const hoverMarkerIds = mapStateStore.interaction.hoverElements.get(key) as
      | Set<number>
      | undefined
    const focusMarkerIds = mapStateStore.interaction.focusElements.get(key) as
      | Set<number>
      | undefined
    const markedMarkerIds = archiveStore.currentArchive.body.Data_KYJG as Set<number>

    return new GSMarkerLayer({
      data: mapStateStore.currentMarkers,
      _dataDiff: markerDataDiff,
      hoverMarkerIds,
      focusMarkerIds,
      markedMarkerIds,
      iconAtlas: iconStore.markerSpriteUrl,
      iconMapping: iconStore.markerSpriteMapping,
      transparentMarked: preferenceStore.transparentMarked,
      rewritePositions: rewritePositions.value,
    })
  })

  return {
    markerLayer,
  }
}
