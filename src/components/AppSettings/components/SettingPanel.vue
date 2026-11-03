<script setup lang="ts"></script>

<template>
  <div class="h-full overflow-hidden">
    <el-scrollbar class="setting-panel-scrollbar">
      <slot name="default" />
    </el-scrollbar>
  </div>
</template>

<style scoped>
.setting-panel-scrollbar {
  :deep(.el-scrollbar__wrap) {
    .el-scrollbar__view {
      padding: 0 8px;
    }
  }
}
</style>
