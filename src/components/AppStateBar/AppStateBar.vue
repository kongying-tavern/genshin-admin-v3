<script setup lang="ts">
import { useAccessStore } from '@/stores'
import {
  PaintMarkerLink,
  SwitchMarkerPopover,
  SwitchOverlay,
  ViewState,
  WebSocketStatus,
} from './components'

const accessStore = useAccessStore()

const virtualRef = ref<HTMLElement>()
const contentZoneRef = ref<HTMLElement>()

const tooltipContent = ref('')

onClickOutside(contentZoneRef, () => {
  virtualRef.value = undefined
})

const checkTooltip = (ev: Event) => {
  const findRes = ev.composedPath().find(target => {
    return target instanceof HTMLElement && target.dataset.label
  })
  if (!findRes) {
    virtualRef.value = undefined
    return
  }
  virtualRef.value = findRes as HTMLElement
  tooltipContent.value = (findRes as HTMLElement).dataset.label ?? ''
}
useEventListener('pointermove', checkTooltip)
useEventListener('click', checkTooltip)
</script>

<template>
  <div class="map-state-bar">
    <div ref="contentZoneRef" class="bar-content">
      <PaintMarkerLink v-if="accessStore.get('MANAGER_COMPONENT')" />
      <SwitchMarkerPopover />
      <SwitchOverlay />
      <WebSocketStatus />
      <ViewState />
    </div>

    <el-tooltip
      :visible="Boolean(tooltipContent && virtualRef)"
      :virtual-ref="virtualRef"
      :content="tooltipContent"
      :offset="8"
      popper-class="state-bar-tooltip font-['HYWenHei-85W']"
      placement="top"
      effect="customized"
      virtual-triggering
    />
  </div>
</template>

<style>
.el-popper.is-customized.state-bar-tooltip {
  padding: 2px 4px;
  background: #495168;
  color: #ece5d8;
  font-size: 12px;
  .el-popper__arrow {
    display: none;
  }
}
</style>

<style scoped>
.map-state-bar {
  position: fixed;
  bottom: 4px;
  right: 4px;
  z-index: 9;
  background-clip: content-box;
  pointer-events: none;
}

.bar-content {
  border-radius: 4px;
  background: #263240;
  color: #c6c2ba;
  padding: 2px;
  pointer-events: all;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  border: 1px solid #ece5d820;
}
</style>
