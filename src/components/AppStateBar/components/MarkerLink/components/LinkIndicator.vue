<script setup lang="ts">
import type { GSMarkerInfo } from '@/packages/map'
import type { LinkActionEnum } from '@/shared'
import LinkActionLabel from './LinkActionLabel.vue'

defineProps<{
  position: { x: number; y: number }
  linkAction: LinkActionEnum
  prevMarker?: GSMarkerInfo
  nextMarker?: GSMarkerInfo
}>()
</script>

<template>
  <div
    class="w-[160px] p-1 rounded absolute left-0 top-0 z-[1000] bg-[var(--el-bg-color)] border border-[var(--el-border-color)] text-[var(--el-text-color-regular)] text-sm pointer-events-none"
    :style="{ transform: `translate(${position.x + 30}px, ${position.y}px)` }"
  >
    <div>当前关联类型</div>
    <LinkActionLabel :value="linkAction" class="bg-[var(--el-fill-color)] p-1" />
    <div
      :class="
        !prevMarker
          ? 'text-[var(--el-color-success)]'
          : !nextMarker
            ? 'text-[var(--el-color-success)]'
            : 'text-[var(--el-color-warning)]'
      "
    >
      {{ !prevMarker ? '请选择起始点' : !nextMarker ? '请选择终止点' : '再次选择终止点以确认' }}
    </div>
  </div>
</template>
