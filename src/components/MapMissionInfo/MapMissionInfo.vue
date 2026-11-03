<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="mission-info">
    <div class="text-lg font-bold">
      {{ title }}
    </div>

    <div v-if="$slots.default">
      <slot name="default" />
    </div>
  </div>
</template>

<style scoped>
@keyframes missioninfo-anime-in {
  from {
    transform: translateX(calc(100% + 8px));
  }
  to {
    transform: translateX(0px);
  }
}

.mission-info {
  @apply absolute right-1 bottom-[48px] p-2 px-3
    border border-[#ECE5D820] rounded
    text-sm text-[#C6C2BA]
    bg-[#263240]
    pointer-events-auto;
  animation: missioninfo-anime-in ease 150ms;
}

.keyboard-key {
  @apply inline-block p-px px-1
    border border-[#C6C2BA] rounded
    text-xs;
}
</style>
