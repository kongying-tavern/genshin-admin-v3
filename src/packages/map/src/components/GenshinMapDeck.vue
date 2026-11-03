<script setup lang="ts">
import type { LayersList } from 'deck.gl'
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

onMounted(() => {
  modelCanvasRef.value = canvasRef.value
})

// WebGL 上下文丢失时刷新页面
useEventListener(canvasRef, 'webglcontextlost', () => {
  location.reload()
})

const { instanceRef } = useGenshinMap(canvasRef, {
  initialViewState: viewState.value,
  layers: props.layers,
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
  layers => {
    instanceRef.value?.setProps({ layers })
  },
)
</script>

<template>
  <canvas
    ref="canvasRef"
    draggable="false"
    @contextmenu.stop.prevent=""
    @focus="ev => $emit('focus', ev)"
    @blur="ev => $emit('blur', ev)"
  />
</template>
