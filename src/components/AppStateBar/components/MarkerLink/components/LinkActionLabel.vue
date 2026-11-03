<script setup lang="ts">
import type { LinkActionEnum } from '@/shared'
import { LINK_ACTION_CONFIG, LINK_ACTION_NAME_MAP } from '@/shared'

defineProps<{
  value: LinkActionEnum
}>()
</script>

<template>
  <div class="w-full h-full overflow-hidden flex items-center gap-1">
    <div
      class="w-[5px] h-[16px] shrink-0 bg-[var(--bg)] border border-white border-opacity-40"
      :style="{ '--bg': `rgba(${LINK_ACTION_CONFIG[value].lineColor.join(' ')})` }"
    />
    <div class="flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
      {{ LINK_ACTION_NAME_MAP.get(value) }}
    </div>
  </div>
</template>
