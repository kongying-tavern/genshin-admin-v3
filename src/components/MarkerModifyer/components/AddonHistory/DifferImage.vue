<script setup lang="ts">
import { Right } from '@element-plus/icons-vue'

withDefaults(
  defineProps<{
    history?: string
    current?: string
  }>(),
  {
    history: '',
    current: '',
  },
)
</script>

<template>
  <div class="flex justify-center items-center">
    <el-image
      class="image-container"
      :src="history"
      :preview-src-list="[history]"
      preview-teleported
    >
      <template #error>
        <div class="error-content">无</div>
      </template>
    </el-image>

    <el-icon :size="20" class="mx-2">
      <Right />
    </el-icon>

    <el-image
      class="image-container"
      :src="current"
      :preview-src-list="[current]"
      preview-teleported
    >
      <template #error>
        <div class="error-content">无</div>
      </template>
    </el-image>
  </div>
</template>

<style scoped>
.image-container {
  @apply w-32 h-32 rounded
    border border-[var(--el-border-color)];
}

.error-content {
  @apply w-full h-full grid place-content-center rounded
    text-xs text-[var(--el-text-color-secondary)];
}
</style>
