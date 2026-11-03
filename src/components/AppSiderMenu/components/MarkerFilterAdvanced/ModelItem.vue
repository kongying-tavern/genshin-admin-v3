<script lang="ts" setup>
import type { MaybeComputedRef } from '@vueuse/core'
import type { MAFGroupComposed, MAFItemComposed } from '@/stores/types'
import { ArrowDownBold, ArrowUpBold, DeleteFilled } from '@element-plus/icons-vue'
import { AppDraggableTable } from '@/components'
import { MarkerFilterButton } from '../MarkerFilterComponent'

const props = defineProps<{
  disabled?: boolean
  isFirst?: boolean
  isLast?: boolean
  withMoveUp?: boolean
  withMoveDown?: boolean
  composedCondition: MaybeComputedRef<MAFGroupComposed>
}>()

const emits = defineEmits<{
  switchOperator: []
  toggleOpposite: []
  moveUpGroup: []
  moveDownGroup: []
  deleteGroup: []
  appendItem: []
  reorderItems: [orderedKeys: string[]]
}>()

const composedConditionValue = computed(() => toValue(props.composedCondition))

const handleSwitchOperator = () => {
  if (props.disabled) return
  emits('switchOperator')
}

const handleToggleOpposite = () => {
  if (props.disabled) return
  emits('toggleOpposite')
}

const handleMoveUpGroup = () => {
  if (props.disabled) return
  emits('moveUpGroup')
}

const handleMoveDownGroup = () => {
  if (props.disabled) return
  emits('moveDownGroup')
}

const handleDeleteGroup = () => {
  if (props.disabled) return
  emits('deleteGroup')
}

const handleAppendItem = () => {
  if (props.disabled) return
  emits('appendItem')
}

const handleReorderItems = (orderedChildren: MAFItemComposed[]) => {
  if (props.disabled) return
  emits(
    'reorderItems',
    orderedChildren.map(({ key }) => key),
  )
}
</script>

<template>
  <div class="condition-group flex flex-col p-1 gap-1">
    <div class="condition-group-title flex">
      <div class="flex-none flex gap-1">
        <MarkerFilterButton
          theme="dark"
          icon-color="var(--gs-color-danger)"
          @click="handleDeleteGroup"
        >
          <template #icon>
            <DeleteFilled />
          </template>
          删除
        </MarkerFilterButton>
      </div>

      <div class="flex-auto" />

      <div class="flex-none flex gap-1">
        <MarkerFilterButton
          v-if="!isFirst"
          theme="dark"
          icon-color="var(--gs-color-text)"
          @click="handleSwitchOperator"
        >
          <template #icon>
            {{ composedConditionValue.operator ? '且' : '或' }}
          </template>
        </MarkerFilterButton>
        <MarkerFilterButton
          theme="dark"
          :icon-color="
            composedConditionValue.opposite ? 'var(--gs-color-confirm)' : 'var(--gs-color-text)'
          "
          @click="handleToggleOpposite"
        >
          <template #icon> 非 </template>
        </MarkerFilterButton>
        <MarkerFilterButton
          v-if="withMoveUp && !isFirst"
          theme="dark"
          icon-color="var(--gs-color-confirm)"
          @click="handleMoveUpGroup"
        >
          <template #icon>
            <ArrowUpBold />
          </template>
        </MarkerFilterButton>
        <MarkerFilterButton
          v-if="withMoveDown && !isLast"
          theme="dark"
          icon-color="var(--gs-color-confirm)"
          @click="handleMoveDownGroup"
        >
          <template #icon>
            <ArrowDownBold />
          </template>
        </MarkerFilterButton>
        <MarkerFilterButton
          theme="dark"
          icon-color="var(--gs-color-success)"
          @click="handleAppendItem"
        >
          <template #icon>
            <Plus />
          </template>
          新增条目
        </MarkerFilterButton>
      </div>
    </div>

    <AppDraggableTable
      v-if="composedConditionValue.children.length > 0"
      :model-value="composedConditionValue.children"
      class="flex flex-col gap-1"
      :get-key="i => i.key"
      @change="handleReorderItems"
    >
      <template
        #default="{
          item,
          index: itemIndex,
          isGrabbing: isItemGrabbing,
          isDragging: isItemDragging,
        }"
      >
        <slot
          :composed-condition="item"
          :index="itemIndex"
          :size="composedConditionValue.children.length"
          :is-first="itemIndex <= 0"
          :is-last="itemIndex >= composedConditionValue.children.length - 1"
          :is-grabbing="isItemGrabbing"
          :is-dragging="isItemDragging"
        />
      </template>
    </AppDraggableTable>
  </div>
</template>

<style lang="scss" scoped>
.condition-group {
  --height: 32px;
  --radius: 16px;
  --color-light: #c6c2ba;
  --color-dark: #313131;

  border-radius: var(--radius);
  background-color: var(--color-light);
  color: var(--color-dark);
}
</style>
