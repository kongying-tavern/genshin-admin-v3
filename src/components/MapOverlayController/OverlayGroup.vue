<script lang="ts" setup>
import type { OverlayChunk, OverlayChunkGroup } from '@/packages/map'
import { ElRadio } from 'element-plus'
import { useOverlayStore } from '@/stores'

const props = defineProps<{
  group: OverlayControllerChunkGroup
}>()

interface OverlayControllerChunkGroup extends OverlayChunkGroup {
  chunks: OverlayChunk[]
}

const overlayStore = useOverlayStore()

const items = computed(() => {
  const { chunks, name: groupName } = props.group
  // 将所属于同一个 item 的 chunk 进行合并
  const { list: mergedChunks } = chunks.reduce(
    (collect, chunk) => {
      if (!collect.ids.has(chunk.item.id)) {
        collect.ids.add(chunk.item.id)
        collect.list.push(chunk)
      }
      return collect
    },
    { list: [] as OverlayChunk[], ids: new Set<string>() },
  )
  return Map.groupBy(mergedChunks, ({ item }) => {
    const prefix = item.name.match(new RegExp(`(${groupName})·`))?.[1]
    return {
      ...item,
      name: prefix ? item.name.replace(prefix, '~') : item.name,
    }
  })
})

const tileModelValue = computed({
  get: () => {
    const item = [...items.value.entries()].find(([{ id: itemId }]) => {
      return overlayStore.activedItemIds.has(itemId)
    })
    if (!item) return ''
    return item[0].id
  },
  set: itemId => {
    const newSet = new Set(overlayStore.activedItemIds)
    items.value.forEach((_, { id }) => newSet.delete(id))
    newSet.delete(itemId)
    newSet.add(itemId)
    overlayStore.activedItemIds = newSet
  },
})

const resetItemVisible = () => {
  const newSet = new Set(overlayStore.activedItemIds)
  items.value.forEach((_, { id }) => {
    newSet.delete(id)
  })
  overlayStore.activedItemIds = newSet
}

const toggleOverlayItem = (itemId: string, bool: boolean) => {
  overlayStore.toggleItem(itemId, bool)
}

const itemOrderMap = computed(() => {
  const orderMap = new Map<string, number>()
  const groupItemIds = [...items.value.keys()].map(item => item.id)
  const activedArray = [...overlayStore.activedItemIds]

  const activeItemsInGroup = groupItemIds
    .filter(id => overlayStore.activedItemIds.has(id))
    .sort((a, b) => activedArray.indexOf(a) - activedArray.indexOf(b))

  activeItemsInGroup.forEach((id, index) => {
    orderMap.set(id, index)
  })

  return orderMap
})
</script>

<template>
  <div class="overlay-group">
    <div class="flex justify-between rounded-[4px_4px_0_0] overflow-hidden">
      <div class="py-1 px-2 w-full flex items-center gap-1 overflow-hidden">
        <div class="overflow-hidden whitespace-nowrap text-ellipsis" :title="group.name">
          {{ group.name }}
        </div>
        <div
          v-if="group.role === 'tile'"
          class="flex-shrink-0 translate-y-[-1px] px-1 pb-0.5 pt-[3px] grid place-items-center border border-[#DEA827] rounded text-xs text-[#C59A44] bg-[#F9ED99]"
          title="当前附加图层组属于底图类型，在显示模式上将会区分于普通附加图层"
        >
          底图
        </div>
      </div>

      <el-icon
        v-if="group.multiple"
        class="p-2 cursor-pointer hover:bg-[#FF5F4040] active:bg-[#FF5F4020]"
        color="#FF5F40"
        title="重置图层可见性"
        :size="32"
        @click="resetItemVisible"
      >
        <RefreshLeft />
      </el-icon>
    </div>

    <div class="flex flex-wrap p-1 gap-1">
      <!-- 单选图层 -->
      <template v-if="!group.multiple">
        <ElRadio
          v-for="[item] in items"
          :key="item.id"
          v-model="tileModelValue"
          :title="item.name"
          :value="item.id"
          :class="{
            'is-actived': overlayStore.activedItemIds.has(item.id),
          }"
          class="overlay-item px-2"
          style="
            margin-right: 0;
            --el-radio-input-bg-color: white;
            --el-radio-input-border: 1px solid white;
          "
        >
          <div class="text-container">
            {{ item.name }}
          </div>
        </ElRadio>
      </template>

      <!-- 多选图层 -->
      <template v-else>
        <div
          v-for="[item] in items"
          :key="item.id"
          class="overlay-item gap-2 h-8 py-0.5 pl-1 pr-2"
          :class="{
            'is-actived': overlayStore.activedItemIds.has(item.id),
          }"
          :title="item.name"
          @click="toggleOverlayItem(item.id, !overlayStore.activedItemIds.has(item.id))"
        >
          <div v-if="overlayStore.activedItemIds.has(item.id)" class="order-badge w-4 h-4 rounded">
            <code>{{ itemOrderMap.get(item.id) }}</code>
          </div>
          <div v-else class="w-4 h-4 shrink-0 rounded bg-white" />
          <div class="flex-1 overflow-hidden" style="container-type: inline-size">
            <div class="text-container w-full text-sm select-none">
              {{ item.name }}
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay-group {
  background: #f7f2e8;
  border: 2px solid #d6ad8560;
  color: #495366;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

@keyframes marquee {
  to {
    transform: translateX(min(100cqw - 100%, 0px));
  }
}

.overlay-item {
  width: 200px;
  color: #495366;
  overflow: hidden;
  border: 2px solid transparent;
  background: #d6ad8540;
  border-radius: 4px;
  display: flex;
  align-items: center;
  cursor: pointer;

  &:hover {
    border-color: #d6ad8520;
    background: #d6ad8560;
  }
  &:active {
    background: #d6ad8530;
  }

  &.is-actived {
    border-color: #d6ad85;
  }

  /* 单选图层用 ElRadio 渲染，label 类是 .el-radio__label
     （此处曾误写为 .el-checkbox__label，类名不存在于本组件 DOM，覆盖一直未生效） */
  :deep(.el-radio__label) {
    text-overflow: ellipsis;
    flex: 1;
    container-type: inline-size;
    overflow: hidden;
  }
}

.order-badge {
  background: var(--el-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;

  &.is-hidden {
    visibility: hidden;
  }
}

.text-container {
  width: max-content;
  white-space: nowrap;
  animation: marquee 3s linear infinite both alternate;
}
</style>
