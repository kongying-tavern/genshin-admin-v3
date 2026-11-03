<script lang="ts" setup>
import type { OverlayChunk, OverlayChunkGroup } from '@/packages/map'
import { useArchiveStore, useOverlayStore } from '@/stores'
import OverlayArea from './OverlayArea.vue'
import OverlayGroup from './OverlayGroup.vue'

const overlayStore = useOverlayStore()
const archiveStore = useArchiveStore()

const areaCode = computed(() => {
  return archiveStore.currentArchive.body.Preference['markerFilter.state.areaCode']
})

const overlayGroups = computed(() => {
  if (!areaCode.value) return new Map<OverlayChunkGroup, OverlayChunk[]>()

  const currentAreaCode = areaCode.value

  const index = (chunk: OverlayChunk): number =>
    Number(chunk?.group?.areaIndexes?.get(currentAreaCode))
  const chunks = overlayStore.existOverlays
    .filter(chunk => chunk.areaCodes.has(currentAreaCode))
    .sort((a, b) => index(a) - index(b))

  const groups = Map.groupBy(chunks, ({ group }) => {
    return group
  })

  return groups
})
</script>

<template>
  <div
    class="overlay-control-panel font-['HYWenHei-85W'] w-full h-full overflow-hidden flex flex-col"
  >
    <OverlayArea />

    <div class="overlay-scrollbar overflow-auto flex-1 flex flex-col p-2 gap-2">
      <OverlayGroup
        v-for="[group, chunks] in overlayGroups"
        :key="group.id"
        :group="{ ...group, chunks }"
      />
    </div>
  </div>
</template>

<style scoped>
.overlay-control-panel {
  background: #ece5d8;
}

.overlay-scrollbar {
  &::-webkit-scrollbar {
    width: 8px;
    background-color: #d9d3c8;
  }
  &::-webkit-scrollbar-thumb {
    background-color: #4a5366;
  }
  &::-webkit-scrollbar-thumb:hover {
    background-color: #4a536680;
  }
}
</style>
