<script lang="ts" setup>
import type { MAFItemComposed } from '@/stores/types'
import { MarkerFilterButton } from '../MarkerFilterComponent'

const props = defineProps<{
  disabled?: boolean
  isFirst?: boolean
  isLast?: boolean
  withMoveUp?: boolean
  withMoveDown?: boolean
  composedCondition: MAFItemComposed
}>()

const emits = defineEmits<{
  switchOperator: []
  toggleOpposite: []
  moveUpItem: []
  moveDownItem: []
  deleteItem: []
}>()

const handleSwitchOperator = () => {
  if (props.disabled) return
  emits('switchOperator')
}

const handleToggleOpposite = () => {
  if (props.disabled) return
  emits('toggleOpposite')
}

const handleMoveUpItem = () => {
  if (props.disabled) return
  emits('moveUpItem')
}

const handleMoveDownItem = () => {
  if (props.disabled) return
  emits('moveDownItem')
}

const handleDeleteItem = () => {
  if (props.disabled) return
  emits('deleteItem')
}
</script>

<template>
  <div class="condition-item flex">
    <div class="flex-none flex gap-1 items-center mr-0.5">
      <MarkerFilterButton
        v-if="!isFirst"
        theme="dark"
        icon-color="var(--gs-color-text)"
        @click="handleSwitchOperator"
      >
        <template #icon>
          {{ composedCondition.operator ? '且' : '或' }}
        </template>
      </MarkerFilterButton>
      <MarkerFilterButton
        theme="dark"
        :icon-color="
          composedCondition.opposite ? 'var(--gs-color-confirm)' : 'var(--gs-color-text)'
        "
        @click="handleToggleOpposite"
      >
        <template #icon> 非 </template>
      </MarkerFilterButton>
    </div>
    <slot />
    <div class="flex-none flex gap-1 items-center">
      <MarkerFilterButton
        v-if="withMoveUp && !isFirst"
        icon-color="var(--gs-color-success)"
        @click="handleMoveUpItem"
      >
        <template #icon>
          <ArrowUpBold />
        </template>
      </MarkerFilterButton>
      <MarkerFilterButton
        v-if="withMoveDown && !isLast"
        icon-color="var(--gs-color-success)"
        @click="handleMoveDownItem"
      >
        <template #icon>
          <ArrowDownBold />
        </template>
      </MarkerFilterButton>
      <MarkerFilterButton icon-color="var(--gs-color-danger)" @click="handleDeleteItem">
        <template #icon>
          <CloseBold />
        </template>
      </MarkerFilterButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.condition-item {
  border-radius: calc(var(--height) / 2);
  background-color: #e6e3de;
  font-size: 14px;
  padding: 2px 4px;
}
</style>
