import type { LayersList } from 'deck.gl'
import type { GSMarkerInfo } from '@/packages/map'
import { LineLayer } from 'deck.gl'
import { GSOverlayer, GSTileLayer } from '@/packages/map'
import { TempLayerIndex } from '@/shared'
import { useMapStateStore, useOverlayStore, useTileStore } from '@/stores'
import { useLinkLayer } from './useLinkLayer'
import { useMarkerLayer } from './useMarkerLayer'
import { useTagLayer } from './useTagLayer'

export const useMapLayers = () => {
  const tileStore = useTileStore()
  const overlayStore = useOverlayStore()
  const mapStateStore = useMapStateStore()

  const { data: markerDraggingMission } = mapStateStore.subscribeMission(
    'markerDragging',
    () => new Map(),
  )

  // ============================== 底图图层 ==============================
  const tileLayer = computed(() => {
    const tile = tileStore.currentTileConfig?.tile
    if (!tile) return
    return new GSTileLayer({
      code: tile.code,
      size: tile.size,
      extension: tile.extension,
      tilesOffset: tile.tilesOffset,
    })
  })

  // ============================== 附加图层 ==============================
  const overlayer = computed(() => {
    if (!tileStore.currentTileConfig) return
    const [w, h] = tileStore.currentTileConfig.tile.size
    const [ox, oy] = tileStore.currentTileConfig.tile.tilesOffset
    const xmin = ox
    const ymin = oy
    const xmax = w + ox
    const ymax = h + oy
    return new GSOverlayer({
      bounds: [xmin, ymin, xmax, ymax],
      showOverlayMask: overlayStore.showMask,
      chunkMap: overlayStore.chunkMap,
      normalChunks: overlayStore.visibleChunks.default,
      tileLikeChunks: overlayStore.visibleChunks.tile,
    })
  })

  // ============================== 标签图层 ==============================
  const { tagLayer } = useTagLayer()

  // ============================== 拖拽指示 ==============================
  const markerDraggingLineLayer = computed(() => {
    if (!markerDraggingMission.value.size) return
    const markers: GSMarkerInfo[] = []
    markerDraggingMission.value.forEach((_, markerId) => {
      const marker = mapStateStore.currentMarkerIdMap.get(markerId)
      marker && markers.push(marker)
    })
    return new LineLayer<GSMarkerInfo>({
      id: 'marker-dragging-line',
      data: markers,
      getColor: [255, 255, 0, 255],
      getWidth: 2,
      getSourcePosition: ({ render }) => {
        return render.position
      },
      getTargetPosition: ({ id, render }) => {
        return markerDraggingMission.value.get(id!) ?? render.position
      },
    })
  })

  // ============================== 关联图层 ==============================
  const { linkLayer } = useLinkLayer()

  // ============================== 点位图层 ==============================
  const { markerLayer } = useMarkerLayer()

  // ============================== 图层汇总 ==============================
  const layers = computed<LayersList>(() => {
    const res = [
      tileLayer.value,

      overlayer.value,

      tagLayer.value,

      linkLayer.value,

      ...mapStateStore.tempLayer.toLayers(TempLayerIndex.BeforeMarkerDraggingLine),
      markerDraggingLineLayer.value,
      ...mapStateStore.tempLayer.toLayers(TempLayerIndex.AfterMarkerDraggingLine),

      ...mapStateStore.tempLayer.toLayers(TempLayerIndex.BeforeMarker),
      markerLayer.value,
      ...mapStateStore.tempLayer.toLayers(TempLayerIndex.AfterMarker),
    ]
    return res
  })

  return {
    layers,
  }
}
