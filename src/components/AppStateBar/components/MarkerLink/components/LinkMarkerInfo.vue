<script setup lang="ts">
import { AppIconTagRenderer } from '@/components'
import { useAreaStore, useIconStore, useItemStore, useMarkerStore } from '@/stores'
import { pickMainItem } from '@/utils'

const props = defineProps<{
  markerId?: number
  reverse?: boolean
}>()

const areaStore = useAreaStore()
const iconStore = useIconStore()
const itemStore = useItemStore()
const markerStore = useMarkerStore()

const markerInfo = computed(() => {
  const { markerId } = props
  if (markerId === undefined) return
  const markerInfo = markerStore.idMap.get(markerId)
  if (!markerInfo) return
  const { mainIconId } = pickMainItem(markerInfo, itemStore.itemIdMap)
  return {
    ...markerInfo,
    render: {
      mainIconId,
    },
  }
})

const areas = computed(() => {
  if (!markerInfo.value?.itemList?.length) return []
  const result = markerInfo.value.itemList.reduce((set, { itemId }) => {
    if (itemId === undefined) return set
    const item = itemStore.itemIdMap.get(itemId)
    if (item?.areaId === undefined) return set
    const area = areaStore.areaIdMap.get(item.areaId)
    if (!area || set.has(area.name!)) return set
    set.add(area.name!)
    return set
  }, new Set<string>())
  return Array.from(result)
})
</script>

<template>
  <div class="overflow-hidden my-1" :class="reverse ? 'pl-1' : 'pr-1'">
    <template v-if="!markerInfo">
      {{ markerId ?? '-- N/A --' }}
    </template>

    <div
      v-else
      class="flex items-center overflow-hidden"
      :class="reverse ? 'flex-row-reverse' : ''"
    >
      <AppIconTagRenderer
        :src="iconStore.iconTextureUrl"
        :mapping="iconStore.iconCoordMap.get(markerInfo.render.mainIconId)"
        class="w-10 h-10 p-1 shrink-0 bg-[var(--el-color-info-light-9)] bg-clip-content rounded-[20px]"
      />

      <div class="flex flex-col overflow-hidden">
        <div class="w-full overflow-hidden whitespace-nowrap text-ellipsis leading-none mb-1">
          {{ markerInfo.markerTitle }}
        </div>
        <div
          class="w-full overflow-hidden whitespace-nowrap text-ellipsis text-[var(--el-text-color-secondary)] leading-none"
          :class="reverse ? 'text-right' : ''"
        >
          {{ areas.join(', ') }}
        </div>
      </div>
    </div>
  </div>
</template>
