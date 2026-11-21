<script setup lang="ts">
import type { IconVo } from '@/api/alova/globals.js'
import { AppVirtualTable } from '@/components/AppVirtualTable'
import { ICON_DRAG_TYPE } from '../types'
import IconImage from './IconImage.vue'

const props = defineProps<{
  data: IconVo[]
  canDrag: boolean
  assigningIcons: ReadonlySet<number>
}>()

const emit = defineEmits<{
  dragStart: [id: number]
  dragEnd: []
}>()

const ICON_SIZE = 100

const activedIcon = defineModel<number | undefined>('activedItem', {
  required: true,
})

const canDragIcon = (id: number | undefined): id is number =>
  props.canDrag && id !== undefined && !props.assigningIcons.has(id)

const startDrag = (event: DragEvent, id?: number) => {
  if (!canDragIcon(id) || !event.dataTransfer) {
    event.preventDefault()
    return
  }
  event.dataTransfer.setData(ICON_DRAG_TYPE, String(id))
  event.dataTransfer.effectAllowed = 'copy'
  emit('dragStart', id)
}
</script>

<template>
  <div class="h-full overflow-hidden" element-loading-text="正在处理...">
    <AppVirtualTable :data="data" :cached-rows="1" :item-height="ICON_SIZE" :item-width="ICON_SIZE">
      <template #default="{ item: icon }">
        <button
          type="button"
          class="grid-item"
          :title="icon.tag"
          :aria-pressed="icon.id === activedIcon"
          :aria-busy="icon.id !== undefined && assigningIcons.has(icon.id)"
          :draggable="canDragIcon(icon.id)"
          :class="{
            'is-actived': icon.id === activedIcon,
          }"
          @click="activedIcon = icon.id"
          @dragstart="startDrag($event, icon.id)"
          @dragend="emit('dragEnd')"
        >
          <IconImage :url="icon.url" alt="" />
          <span class="item-label">
            {{ icon.tag }}
          </span>
        </button>
      </template>
    </AppVirtualTable>
  </div>
</template>

<style scoped>
.grid-item {
  --bg-color: transparent;

  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  overflow: hidden;
  padding: 0;
  border-radius: 6px;
  background-color: var(--bg-color);
  transition: background-color 100ms ease;
  border: 1px solid transparent;
  background-clip: padding-box;
  cursor: pointer;
  user-select: none;

  &.is-actived {
    --bg-color: var(--el-color-primary-light-7);
    border-radius: 4px;
  }

  &:not(.is-actived):hover {
    --bg-color: var(--el-color-primary-light-9);
  }

  &:not(.is-actived):active {
    --bg-color: var(--el-color-primary-light-7);
    border-radius: 4px;
  }
}

.grid-item[draggable='true'] {
  cursor: grab;
}

.grid-item[aria-busy='true'] {
  cursor: progress;
}

.grid-item:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.item-label {
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: center;
  padding: 8px;
  color: var(--el-text-color-primary);
}
</style>
