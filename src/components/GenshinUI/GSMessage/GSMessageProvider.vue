<script lang="ts" setup>
import { GSMessage, GSMessageService } from '@/components'

withDefaults(
  defineProps<{
    index?: number
  }>(),
  {
    index: 4000,
  },
)
</script>

<template>
  <div
    class="gs-message-provider"
    :class="{
      actived: GSMessageService.visible,
      closed: !GSMessageService.visible,
    }"
  >
    <GSMessage
      v-if="GSMessageService.visible"
      :message="GSMessageService.props?.message"
      :type="GSMessageService.props?.type"
      :duration="GSMessageService.props?.duration"
      @close="GSMessageService.close"
    />
  </div>
</template>

<style lang="scss" scoped>
@keyframes gs-message-model-anime-in {
  from {
    background-color: transparent;
  }
  to {
    background-color: #00000080;
  }
}

@keyframes gs-message-model-anime-out {
  from {
    background-color: #00000080;
  }
  to {
    background-color: transparent;
  }
}

.gs-message-provider {
  position: fixed;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  background-color: transparent;
  transition: all ease-out 150ms;
  z-index: v-bind(index);
  pointer-events: none;
  &.actived {
    pointer-events: all;
    animation: gs-message-model-anime-in ease-out 150ms forwards;
  }
  &.closed {
    animation: gs-message-model-anime-out ease-out 150ms forwards;
  }
}
</style>
