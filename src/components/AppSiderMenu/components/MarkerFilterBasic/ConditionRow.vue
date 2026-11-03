<script lang="ts" setup>
import type { MBFItem } from '@/stores/types'
import { DeleteFilled } from '@element-plus/icons-vue'
import { MarkerFilterButton } from '../MarkerFilterComponent'

const props = defineProps<{
  disabled?: boolean
  condition: MBFItem
}>()

const emits = defineEmits<{
  (e: 'review'): void
  (e: 'delete'): void
}>()

const handleReview = () => {
  if (props.disabled) return
  emits('review')
}

const handleDelete = () => {
  if (props.disabled) return
  emits('delete')
}
</script>

<template>
  <div class="condition-row font-['HYWenHei-85W']">
    <div class="h-full flex-1 flex items-center p-1 gap-1 overflow-hidden">
      <MarkerFilterButton :clickable="false" :title="condition.area.name">
        {{ condition.area.name }}
      </MarkerFilterButton>

      <MarkerFilterButton :clickable="false">
        {{ condition.type.name }}
      </MarkerFilterButton>

      <MarkerFilterButton :disabled="disabled" @click="handleReview">
        {{ condition.items.length }}
      </MarkerFilterButton>
    </div>

    <div class="p-1 flex-shrink-0">
      <MarkerFilterButton
        :disabled="disabled"
        theme="dark"
        icon-color="var(--gs-color-danger)"
        @click="handleDelete"
      >
        <template #icon>
          <DeleteFilled />
        </template>
        删除
      </MarkerFilterButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.condition-row {
  --height: 32px;
  --color-light: #c6c2ba;
  --color-dark: #313131;

  height: var(--height);
  border-radius: calc(var(--height) / 2);
  display: flex;
  gap: 4px;
  align-items: center;
  background: var(--color-light);
  color: var(--color-dark);
  overflow: hidden;
}
</style>
