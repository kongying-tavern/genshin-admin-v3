<script setup lang="ts">
import type { Layer, LayersList } from 'deck.gl'
import type { GenshinMap } from '../core'
import type { GenshinMapProps, GenshinMapViewState } from '../types'
import { useGenshinMap } from '../hooks'

const props = defineProps<{
  layers?: LayersList
  cursor?: string
  disableViewStateChange?: boolean
  getTooltip?: GenshinMapProps['getTooltip']
}>()

const emits = defineEmits<{
  focus: [FocusEvent]
  blur: [FocusEvent]
  load: [GenshinMap]
  hover: Parameters<NonNullable<GenshinMapProps['onHover']>>
  click: Parameters<NonNullable<GenshinMapProps['onClick']>>
  drag: Parameters<NonNullable<GenshinMapProps['onDrag']>>
  dragEnd: Parameters<NonNullable<GenshinMapProps['onDragEnd']>>
  dragStart: Parameters<NonNullable<GenshinMapProps['onDragStart']>>
}>()

const viewState = defineModel<GenshinMapViewState>('viewState', {
  required: true,
})

const modelCanvasRef = defineModel<HTMLCanvasElement | undefined>('canvasRef', {
  required: false,
  default: undefined,
})

const canvasRef = shallowRef<HTMLCanvasElement>()
const canvasKey = ref(0)

watch(canvasRef, canvas => {
  modelCanvasRef.value = canvas
})

// 新 Deck 不能复用旧 Deck 已初始化的图层。相邻更新沿用仍在绘制的副本。
let layerCopies = new Map<Layer, Layer>()
const getRenderLayers = () => {
  if (canvasKey.value === 0) return props.layers
  const nextCopies = new Map<Layer, Layer>()
  const copyLayer = (layer: LayersList[number]): LayersList[number] => {
    if (Array.isArray(layer)) return layer.map(copyLayer)
    if (!layer) return layer
    const copy = layerCopies.get(layer) ?? layer.clone({})
    nextCopies.set(layer, copy)
    return copy
  }
  const layers = props.layers?.map(copyLayer)
  layerCopies = nextCopies
  return layers
}

const restoreCanvas = async () => {
  const hadFocus = document.activeElement === canvasRef.value
  layerCopies.clear()
  canvasKey.value++
  if (hadFocus) {
    await nextTick()
    canvasRef.value?.focus({ preventScroll: true })
  }
}

const { instanceRef } = useGenshinMap(canvasRef, {
  get initialViewState() {
    return viewState.value
  },
  get layers() {
    return getRenderLayers()
  },
  controller: {
    scrollZoom: {
      transitionDuration: 60,
    },
  },
  getCursor: ({ isDragging, isHovering }) => {
    if (props.cursor?.trim().length) return props.cursor
    if (isHovering) return 'pointer'
    if (isDragging) return 'grabbing'
    return 'inherit'
  },
  getTooltip: info => {
    return props.getTooltip?.(info) ?? null
  },
  onViewStateChange: params => {
    if (props.disableViewStateChange) return params.oldViewState
    const { zoom, target } = params.viewState
    viewState.value.zoom = zoom as number
    viewState.value.target = target as [number, number]
    return params.viewState
  },
  onDrag: (info, event) => {
    emits('drag', info, event)
  },
  onDragEnd: (info, event) => {
    emits('dragEnd', info, event)
  },
  onDragStart: (info, event) => {
    emits('dragStart', info, event)
  },
  onHover: (info, event) => {
    emits('hover', info, event)
  },
  onClick: (info, event) => {
    emits('click', info, event)
  },
  onLoad: () => {
    if (!instanceRef.value) return
    emits('load', instanceRef.value)
  },
})

watch(
  () => viewState.value,
  initialViewState => {
    instanceRef.value?.setProps({ initialViewState })
  },
)
watch(
  () => props.layers,
  () => {
    instanceRef.value?.setProps({ layers: getRenderLayers() })
  },
)
</script>

<template>
  <canvas
    :key="canvasKey"
    ref="canvasRef"
    draggable="false"
    @webglcontextlost.prevent
    @webglcontextrestored="restoreCanvas"
    @contextmenu.stop.prevent=""
    @focus="ev => $emit('focus', ev)"
    @blur="ev => $emit('blur', ev)"
  />
</template>
