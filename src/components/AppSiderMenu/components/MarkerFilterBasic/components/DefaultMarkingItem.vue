<script setup lang="ts">
import { DeleteFilled } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { AppIconTagRenderer } from '@/components'
import { fallbackToStaticIcon } from '@/configs'
import { useAreaStore, useIconStore, useItemStore } from '@/stores'
import { isItemVo } from '@/utils'
import { CheckboxItem, ItemButton } from '..'

defineProps<{
  itemCountMap: Map<number, number>
  itemTotalMap: Map<number, number>
}>()

const areaStore = useAreaStore()
const itemStore = useItemStore()
const iconStore = useIconStore()

const markingItemId = defineModel<number | undefined>('itemId', {
  required: false,
})

const markingItem = computed(() => {
  if (markingItemId.value === undefined) return
  return itemStore.itemIdMap.get(markingItemId.value)
})

const area = computed(() => {
  if (!markingItem.value) return
  return areaStore.areaIdMap.get(markingItem.value.areaId!)
})

const parentArea = computed(() => {
  if (!area.value) return
  return areaStore.areaIdMap.get(area.value.parentId!)
})

const dropzoneRef = ref<HTMLElement>()
const { isOverDropZone } = useDropZone(dropzoneRef)

const removeDefaultMarkingItem = () => {
  markingItemId.value = undefined
}

const handleDragItem = (ev: DragEvent) => {
  if (!ev.dataTransfer) return
  // 数据来源搜索 dataTransfer.setData
  const str = ev.dataTransfer.getData('text')
  if (!str) return
  try {
    const data = JSON.parse(str)
    if (!isItemVo(data)) return
    ev.preventDefault()
    markingItemId.value = data.id!
  } catch {
    // no valid
  }
}
</script>

<template>
  <div
    ref="dropzoneRef"
    class="marking-item"
    :class="{
      'over-drop': isOverDropZone,
      checked: Boolean(markingItem),
    }"
    @drop="handleDragItem"
  >
    <template v-if="!markingItem">
      {{ isOverDropZone ? '放开以应用该物品' : '拖拽物品到此处' }}
    </template>

    <div v-else class="w-full h-12 grid grid-cols-2 gap-1">
      <div class="grid grid-rows-2 grid-cols-[48px_1fr] text-sm overflow-hidden">
        <AppIconTagRenderer
          :src="iconStore.iconTextureUrl"
          :mapping="iconStore.iconCoordMap.get(area?.iconId || parentArea?.iconId || -1)"
          class="row-span-2 w-12 h-12 p-1"
        >
          <img v-if="area" draggable="false" :src="fallbackToStaticIcon(area)" />
        </AppIconTagRenderer>
        <div class="overflow-hidden whitespace-nowrap text-ellipsis" :title="parentArea?.name">
          {{ parentArea?.name ?? '--' }}
        </div>
        <div class="overflow-hidden whitespace-nowrap text-ellipsis" :title="area?.name">
          {{ area?.name ?? '--' }}
        </div>
      </div>

      <CheckboxItem
        is-actived
        :label="markingItem.name"
        style="margin: 0; width: 100%"
        @click="removeDefaultMarkingItem"
      >
        <template #icon>
          <AppIconTagRenderer
            :src="iconStore.iconTextureUrl"
            :mapping="iconStore.iconCoordMap.get(markingItem.iconId ?? -1)"
            class="w-full aspect-square"
          />
        </template>
        <template #default>
          <div class="marking-item--content">
            <ItemButton
              :name="markingItem.name"
              :finished-num="itemCountMap.get(markingItem.id!)"
              :total-num="itemTotalMap.get(markingItem.id!)"
              actived
            />
            <div
              class="grid px-2 place-items-center"
              style="background-color: var(--gs-color-danger)"
            >
              <ElIcon :size="20" color="#FFF">
                <DeleteFilled />
              </ElIcon>
            </div>
          </div>
        </template>
      </CheckboxItem>
    </div>
  </div>
</template>

<style scoped>
.marking-item {
  border: 2px dashed #c6c2ba;
  border-radius: 8px;
  margin: 8px;
  height: 48px;
  display: grid;
  place-items: center;
  color: #c6c2ba;

  &.over-drop {
    border-style: solid;
    border-color: #fff;
  }

  &.checked {
    border-width: 0;
    place-items: flex-start;
  }
}

.marking-item--content {
  width: 100%;
  height: 100%;
  grid-template-columns: 1fr auto;
}
</style>
