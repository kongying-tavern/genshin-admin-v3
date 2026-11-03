<script setup lang="ts">
defineProps<{
  label: string
  isDifferent?: boolean
  autoCollapse?: boolean
}>()
</script>

<template>
  <details
    :open="!autoCollapse || isDifferent"
    class="diff-item ml-1 mr-3 my-2"
    :class="{ 'is-different': isDifferent }"
  >
    <summary class="divider-line font-bold select-none">
      {{ label }}
    </summary>

    <div class="p-1">
      <slot name="default" :is-different="isDifferent" />
    </div>
  </details>
</template>

<style scoped>
.diff-item {
  --summary-text-color: var(--el-text-color-secondary);
  --summary-bg-color: var(--el-color-primary-light-7);

  border: 1px solid var(--summary-bg-color);
  border-radius: 4px;
  overflow: hidden;

  &[open] {
    --summary-text-color: var(--el-text-color-regular);
  }

  &.is-different {
    --summary-text-color: var(--el-color-warning);
    --summary-bg-color: var(--el-color-warning-light-7);
  }
}

.divider-line {
  position: relative;
  color: var(--summary-text-color);
  cursor: pointer;
  padding: 0 4px;
  background: var(--summary-bg-color);

  &::marker {
    background: var(--summary-text-color);
  }
}
</style>
