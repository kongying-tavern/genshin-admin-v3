<script setup lang="ts">
import type { MarkerItemLinkVo } from '@/api/alova/globals'
import { AppIconTagRenderer } from '@/components'
import { useIconStore, useItemStore } from '@/stores'

const props = withDefaults(
  defineProps<{
    history?: MarkerItemLinkVo[]
    current?: MarkerItemLinkVo[]
  }>(),
  {
    history: () => [],
    current: () => [],
  },
)

const itemStore = useItemStore()
const iconStore = useIconStore()

const diffItems = computed(() => {
  const oldIds = props.history.reduce((set, { itemId }) => set.add(itemId!), new Set<number>())
  const oldCountMap = props.history.reduce(
    (map, { itemId, count = 0 }) => map.set(itemId!, count),
    new Map<number, number>(),
  )

  const newIds = props.current.reduce((set, { itemId }) => set.add(itemId!), new Set<number>())
  const newCountMap = props.current.reduce(
    (map, { itemId, count = 0 }) => map.set(itemId!, count),
    new Map<number, number>(),
  )

  const bothIds = newIds.union(oldIds)

  return [...bothIds]
    .map(id => {
      const item = itemStore.itemIdMap.get(id)
      return {
        id,
        item,
        count: newCountMap.get(id) ?? oldCountMap.get(id) ?? 0,
        isCountChanged: newCountMap.get(id) !== oldCountMap.get(id),
        isCreated: !oldIds.has(id),
        isRemoved: !newIds.has(id),
      }
    })
    .toSorted(({ id: idA }, { id: idB }) => idA - idB)
})
</script>

<template>
  <div class="item-viewer w-full flex gap-2">
    <div class="item-list">
      <div
        v-for="{ id, item, count, isCreated, isRemoved, isCountChanged } in diffItems"
        :key="id"
        class="item text-xs"
        :class="{
          'is-created': isCreated,
          'is-removed': isRemoved,
          'is-changed': isCountChanged,
        }"
      >
        <AppIconTagRenderer
          class="w-8 h-8"
          :src="iconStore.iconTextureUrl"
          :mapping="iconStore.iconCoordMap.get(item?.iconId ?? -1)"
        />
        <div class="flex-1">
          <div>id: {{ id }}</div>
          <div>
            {{ item?.name }}
          </div>
        </div>
        <div class="grid place-items-center">数量：{{ count }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-viewer {
  background: linear-gradient(
    to right,
    transparent calc(50% - 0.5px),
    var(--el-border-color) calc(50% - 0.5px),
    var(--el-border-color) calc(50% + 0.5px),
    transparent calc(50% + 0.5px)
  );
}

.item-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item {
  display: flex;
  background-color: var(--el-color-info-light-9);
  padding: 4px 10px 4px 4px;
  gap: 4px;

  &.is-changed {
    background-color: var(--el-color-warning-light-5);
  }

  &.is-created {
    background-color: var(--el-color-success-light-5);
  }

  &.is-removed {
    background-color: var(--el-color-error-light-5);
  }
}
</style>
