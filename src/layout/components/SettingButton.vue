<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'
import { AppSettings } from '@/components'
import { useGlobalDialog } from '@/hooks'

const { DialogService } = useGlobalDialog()

const openSettingDIalog = () => {
  DialogService.config({
    alignCenter: true,
    showClose: false,
    closeOnPressEscape: false,
  }).open(AppSettings)
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
