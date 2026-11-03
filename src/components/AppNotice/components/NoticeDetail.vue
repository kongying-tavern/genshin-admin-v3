<script setup lang="ts">
import type { NoticeVo } from '@/api/alova/globals'
import { AppRichtextEditor } from '@/components'

const props = defineProps<{
  data?: NoticeVo
}>()
</script>

<template>
  <div class="detail">
    <template v-if="props.data">
      <div class="detail-title">
        {{ props.data.title }}
      </div>
      <AppRichtextEditor
        class="flex-1"
        :model-value="props.data.content"
        :base-text-size="20"
        :headers="[2, 4]"
        :view-line-height="1.5"
        :view-zoom="0.75"
        readonly
        default-foreground="#656565"
        default-background="transparent"
        view-font="MHYG, sans-serif"
        scrollbar-color="#D8D7D5"
        scrollbar-thumb-color="#FFF"
        scrollbar-width="8px"
      />
    </template>

    <slot v-else name="placeholder">
      <div class="w-full h-full grid place-content-center">内容被派蒙吃掉了！</div>
    </slot>
  </div>
</template>

<style scoped>
.detail {
  --padding: 2px;
  --line-color: #f5f0ea;
  --link-underline-color: #8cb4ff;
  --link-bg-color: #f5edd5;
  --link-bg-color-hover: #d5e0f7;

  flex: 1;
  flex-shrink: 0;
  background: #f9f6f2;
  position: relative;
  padding: 16px;
  overflow: auto;
  display: flex;
  height: 100%;
  overflow: hidden;
  flex-direction: column;
  outline: none;
  min-height: 100%;
  color: var(--el-text-color-primary);

  @media screen and (max-width: 400px) {
    padding: 16px 8px 8px;
  }
}

.detail-title {
  font-size: 24px;
  line-height: 1.2em;
  padding-bottom: 12px;
  border-bottom: 2px solid #cbc2b040;
  margin-bottom: 16px;
  color: #656565;
}
</style>
