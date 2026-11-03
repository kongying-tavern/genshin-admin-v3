<script setup lang="ts">
import type { AreaVo } from '@/api/alova/globals'
import type { GSMarkerInfo } from '@/packages/map'
import { AppIconTagRenderer } from '@/components'
import { useAreaStore, useIconStore, useItemStore } from '@/stores'

const props = withDefaults(
  defineProps<{
    marker?: GSMarkerInfo
    placeholder?: string
    reverse?: boolean
  }>(),
  {
    placeholder: '--N/A--',
  },
)

const areaStore = useAreaStore()
const itemStore = useItemStore()
const iconStore = useIconStore()

const areas = computed(() => {
  if (!props.marker) return []
  const areaIds = new Set<number>()
  return (
    props.marker.itemList?.reduce((seed, { itemId }) => {
      const item = itemStore.itemIdMap.get(itemId!)
      if (!item) return seed
      const area = areaStore.areaIdMap.get(item.areaId!)
      if (!area || areaIds.has(area.id!)) return seed
      seed.push(area)
      areaIds.add(area.id!)
      return seed
    }, [] as AreaVo[]) ?? []
  )
})
</script>

<template>
  <div class="w-full h-full overflow-hidden p-2">
    <div
      v-if="!marker"
      class="h-[48px] rounded px-2 grid place-content-center bg-[var(--el-fill-color)] text-[var(--el-text-color-secondary)]"
    >
      {{ placeholder }}
    </div>

    <div
      v-else
      class="h-[48px] rounded p-1 flex items-center gap-1 bg-[var(--el-fill-color)]"
      :class="reverse ? 'flex-row-reverse' : ''"
    >
      <AppIconTagRenderer
        :mapping="iconStore.iconCoordMap.get(marker.render.mainIconId)"
        :src="iconStore.iconTextureUrl"
        class="w-10 h-10 bg-[var(--el-color-info-light-7)] p-0.5 rounded-full flex-shrink-0 border border-[var(--el-color-info)]"
      />

      <div class="flex-1 flex flex-col overflow-hidden" :class="reverse ? 'text-right' : ''">
        <div class="whitespace-nowrap overflow-hidden text-ellipsis">
          {{ marker.markerTitle }}
        </div>
        <div class="flex gap-1" :class="reverse ? 'flex-row-reverse' : ''">
          <div
            v-for="area in areas"
            :key="area.id"
            class="text-xs text-[var(--el-text-color-secondary)] overflow-hidden whitespace-nowrap text-ellipsis"
          >
            {{ area.name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marker-info {
  @apply flex-1 flex-shrink-0 overflow-hidden;
  height: 52px;
  font-size: 14px;
  border: 2px solid color-mix(in srgb, var(--color), #00000020);
  border-radius: 30px;
}
</style>
