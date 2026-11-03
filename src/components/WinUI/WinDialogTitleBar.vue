<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'

const props = defineProps<{
  loading?: boolean
  disabled?: boolean
}>()

const emits = defineEmits<{
  close: []
}>()

const emitClose = () => {
  if (props.disabled || props.loading) return
  emits('close')
}
</script>

<template>
  <div class="win-dialog-title-bar">
    <div v-bind="$attrs" class="title-name">
      <slot name="default" />
    </div>

    <div
      class="title-action"
      :class="{
        'is-disabled': disabled,
      }"
      @click="emitClose"
    >
      <el-icon :size="16">
        <Close />
      </el-icon>
    </div>
  </div>
</template>

<style scoped>
.win-dialog-title-bar {
  @apply flex justify-between items-start
    bg-[var(--el-color-primary-light-9)];
}

.title-name {
  @apply overflow-hidden
    h-[28px] flex-1 flex items-center px-2
    text-xs text-ellipsis whitespace-nowrap;
}

.title-action {
  @apply h-full p-1.5 px-2
    grid place-content-center
    transition-all
    select-none;

  &:not(.is-disabled):hover {
    @apply bg-[var(--el-color-danger)]
      text-[var(--el-bg-color)];
  }

  &:not(.is-disabled):active {
    @apply bg-[var(--el-color-danger-light-3)]
      text-[var(--el-bg-color)];
  }

  &.is-disabled {
    @apply cursor-not-allowed;
  }
}
</style>
