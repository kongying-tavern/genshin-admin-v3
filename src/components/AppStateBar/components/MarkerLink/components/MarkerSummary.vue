<script setup lang="ts">
import type { GSMapState } from '@/stores/types/genshin-map-state'
import { AppIconTagRenderer } from '@/components'
import { useIconStore } from '@/stores'

defineProps<{
  data?: GSMapState.MarkerWithRenderConfig
}>()

const iconStore = useIconStore()
</script>

<template>
  <div class="overflow-hidden flex-1 rounded-full border bg-[var(--el-color-primary-light-7)]">
    <div v-if="!data">--/--</div>

    <div v-else class="flex gap-1 items-center overflow-hidden">
      <AppIconTagRenderer
        :src="iconStore.iconTextureUrl"
        :mapping="iconStore.iconCoordMap.get(data.render.mainIconId)"
        class="flex-shrink-0 w-8 h-8 rounded-full p-0.5"
      />
      <div class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
        {{ data.markerTitle }}
      </div>
    </div>
  </div>
</template>
