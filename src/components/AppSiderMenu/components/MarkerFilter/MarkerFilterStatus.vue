<script setup lang="ts">
import { GSButton } from '@/components'
import { useMapStateStore } from '@/stores'

const map = useMapStateStore()
</script>

<template>
  <div
    v-if="map.markersFilterOffline || map.markersFilterLoading || map.markersFilterFailed"
    class="flex-none flex items-center justify-between gap-2 px-3 py-2 text-sm text-[#ece5d8]"
  >
    <span role="status">
      <template v-if="map.markersFilterOffline">联网后自动核对点位</template>
      <template v-else-if="map.markersFilterLoading">正在核对点位…</template>
      <template v-else-if="map.currentLayerMarkers.length">部分点位暂未核对</template>
      <template v-else>暂时无法核对点位</template>
    </span>
    <GSButton
      v-if="map.markersFilterFailed && !map.markersFilterLoading && !map.markersFilterOffline"
      size="small"
      @click="map.retryMarkerFilter"
    >
      重试
    </GSButton>
  </div>
</template>
