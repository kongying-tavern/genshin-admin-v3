<script lang="ts" setup>
import type { MAFGroupComposed } from '@/stores/types'
import { AppDraggableTable } from '@/components'
import { useMapStateStore } from '@/stores'
import { ModelItem } from '.'

const emits = defineEmits<{
  appendItem: [groupIndex: number]
}>()

const modelValue = defineModel<MAFGroupComposed[]>('modelValue', {
  required: true,
  default: [],
})

const mapStateStore = useMapStateStore()

const { toggleMAFGroupOperator, toggleMAFGroupOpposite, deleteMAFGroup, reorderMAFItems } =
  mapStateStore

// ------------------------------------------------
// 模型选择器相关
// ------------------------------------------------
const openPicker = (groupIndex: number) => {
  emits('appendItem', groupIndex)
}
</script>

<template>
  <AppDraggableTable
    v-model="modelValue"
    class="h-full flex flex-col gap-2 sort-list"
    :get-key="g => g.key"
  >
    <template
      #default="{
        item: group,
        index: groupIndex,
        isGrabbing: isGroupGrabbing,
        isDragging: isGroupDragging,
      }"
    >
      <ModelItem
        class="sort-group"
        :class="{
          'is-grabbing': isGroupGrabbing,
          'is-dragging': isGroupDragging,
        }"
        :composed-condition="group"
        :is-first="groupIndex <= 0"
        :is-last="groupIndex >= modelValue.length - 1"
        :with-move-up="false"
        :with-move-down="false"
        @switch-operator="() => toggleMAFGroupOperator(groupIndex)"
        @toggle-opposite="() => toggleMAFGroupOpposite(groupIndex)"
        @delete-group="() => deleteMAFGroup(groupIndex)"
        @append-item="() => openPicker(groupIndex)"
        @reorder-items="orderedKeys => reorderMAFItems(groupIndex, orderedKeys)"
      >
        <template
          #default="{
            composedCondition: item,
            index: itemIndex,
            size: itemSize,
            isFirst: isFirstItem,
            isLast: isLastItem,
            isGrabbing: isItemGrabbing,
            isDragging: isItemDragging,
          }"
        >
          <slot
            :group="group"
            :group-index="groupIndex"
            :is-group-grabbing="isGroupGrabbing"
            :is-group-dragging="isGroupDragging"
            :item="item"
            :item-index="itemIndex"
            :item-size="itemSize"
            :is-first-item="isFirstItem"
            :is-last-item="isLastItem"
            :is-item-grabbing="isItemGrabbing"
            :is-item-dragging="isItemDragging"
          />
        </template>
      </ModelItem>
    </template>
  </AppDraggableTable>
</template>

<style lang="scss" scoped>
.sort-list {
  :deep(.sort-group) {
    position: relative;
    user-select: none;

    &:not(.is-dragging) {
      cursor: pointer;
    }

    --border-color: transparent;
    &:has(.sort-item:not(.is-dragging):hover),
    &:has(.sort-item:not(.is-dragging):active),
    &:has(.sort-item.is-grabbing) {
      --border-color: transparent !important;
    }
    &:not(.is-dragging):hover {
      --border-color: color(from var(--gs-color-cancel) srgb r g b / 0.5);
    }
    &:not(.is-dragging):active {
      --border-color: color(from var(--gs-color-cancel) srgb r g b / 0.3);
    }
    &.is-grabbing {
      --border-color: color(from var(--gs-color-cancel) srgb r g b / 0.8);
    }
    &::after {
      pointer-events: none;
      content: '';
      position: absolute;
      inset: 0;
      border: 3px solid var(--border-color);
      border-radius: 1rem;
    }
  }

  :deep(.sort-item) {
    user-select: none;

    &:not(.is-dragging):hover {
      box-shadow: 0 0 6px var(--gs-color-success);
    }
    &:not(.is-dragging):active {
      box-shadow: none;
    }
    &.is-grabbing {
      box-shadow: 0 0 6px var(--gs-color-confirm);
    }
  }
}
</style>
