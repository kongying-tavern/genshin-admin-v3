<script setup lang="ts">
import { ChatLineRound } from '@element-plus/icons-vue'
import { useNoticeStore } from '@/stores'
import { context } from './context'

const noticeStore = useNoticeStore()
</script>

<template>
  <el-badge :value="noticeStore.newCount" :hidden="!noticeStore.newCount" class="notice-count">
    <el-button
      class="app-notice-button"
      text
      size="large"
      style="--el-border-radius-base: 8px; padding: 8px 12px"
      @click="context.show"
    >
      <el-icon :size="20">
        <ChatLineRound />
      </el-icon>
    </el-button>
  </el-badge>
</template>

<style scoped>
.notice-count {
  :deep(.el-badge__content.is-fixed) {
    transform: translate(40%, 10%);
  }
}
</style>
