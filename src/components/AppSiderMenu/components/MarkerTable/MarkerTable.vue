<script lang="tsx" setup>
import { AppVirtualTable } from '@/components'
import { useMarkerControl } from '@/hooks'
import { useIconStore, useMapStateStore } from '@/stores'
import MarkerFilterStatus from '../MarkerFilter/MarkerFilterStatus.vue'
import MarkerRow from './MarkerRow.vue'

const iconStore = useIconStore()
const mapStateStore = useMapStateStore()

const { hover: hoveredMarker, focus: focusedMarker, focusMarker, hoverMarker } = useMarkerControl()

/**
 * 由于地图依赖点位排序来控制遮挡顺序，这里需要重新排序。
 * 按 ID 降序。
 */
const resortedMarkers = computed(() =>
  mapStateStore.currentLayerMarkers.toSorted(({ id: idA = 0 }, { id: idB = 0 }) => {
    return idB - idA
  }),
)
</script>

<template>
  <div class="marker-filter h-full flex flex-col">
    <MarkerFilterStatus />
    <el-skeleton
      v-if="mapStateStore.markersFilterLoading && !resortedMarkers.length"
      class="marker-list-skeleton px-2"
      aria-hidden="true"
      loading
      animated
    >
      <template #template>
        <div v-for="row in 5" :key="row" class="skeleton-row">
          <el-skeleton-item variant="image" class="skeleton-icon" />
          <div class="flex-1 flex flex-col gap-2">
            <el-skeleton-item variant="text" class="w-3/4" />
            <el-skeleton-item variant="text" class="w-1/3" />
          </div>
        </div>
      </template>
    </el-skeleton>

    <div
      v-else-if="
        !resortedMarkers.length
        && !mapStateStore.markersFilterFailed
        && !mapStateStore.markersFilterOffline
      "
      class="h-full grid place-items-center content-center text-white font-genshin"
    >
      <img class="w-60 h-60" src="/icons/qiliangliang.png" />
      <div>没有符合条件的点位</div>
    </div>

    <AppVirtualTable
      v-else-if="resortedMarkers.length"
      class="flex-1 min-h-0"
      always-scrollbar
      :data="resortedMarkers"
      :item-height="60"
      :cached-rows="2"
      :scrollbar-style="{
        '--el-scrollbar-bg-color': '#D3BC8E',
        '--el-scrollbar-opacity': '1',
        '--el-scrollbar-hover-bg-color': '#D3BC8E',
        '--el-scrollbar-hover-opacity': '0.5',
      }"
    >
      <template #default="{ item }">
        <MarkerRow
          :data="item"
          :is-hover="hoveredMarker?.id === item.id"
          :is-focus="focusedMarker?.id === item.id"
          :icon-src="iconStore.iconTextureUrl"
          :icon-mapping="iconStore.iconCoordMap.get(item.render.mainIconId)"
          @focus="marker => focusMarker(marker)"
          @hover="hoverMarker"
        />
      </template>
    </AppVirtualTable>
  </div>
</template>

<style scoped>
.marker-filter {
  width: 350px;
  max-width: calc(100dvw - 72px);
}

.marker-list-skeleton {
  --el-skeleton-color: #ffffff20;
  --el-skeleton-to-color: #ffffff32;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  margin-bottom: 8px;
  padding: 4px;
  border-radius: 8px;
  background: #ffffff0d;
}

.skeleton-icon {
  flex: none;
  width: 44px;
  height: 44px;
}
</style>
