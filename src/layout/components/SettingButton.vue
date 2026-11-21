<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'
import { openSettingsDialog } from '@/components/AppSettings/open'

const openSettingDIalog = () => {
  openSettingsDialog()
}
</script>

<template>
  <el-button
    class="app-setting-button"
    text
    size="large"
    style="--el-border-radius-base: 8px; padding: 8px 12px"
    @click="openSettingDIalog"
  >
    <el-icon :size="20">
      <Setting />
    </el-icon>
  </el-button>
</template>

<style scoped></style>
