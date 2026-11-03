<script lang="ts" setup>
import type { ItemVo } from '@/api/alova/globals'
import { CircleCloseFilled } from '@element-plus/icons-vue'
import { AppIconTagRenderer } from '@/components'

defineProps<{
  item: ItemVo
  src?: string
  mapping?: [number, number]
}>()
</script>

<template>
  <div v-bind="$attrs" :title="item.name" class="item-selecter-button relative">
    <AppIconTagRenderer :src="src" :mapping="mapping" class="w-8 h-8" />

    <div class="absolute w-4 h-4 top-0 right-0 text-[var(--el-color-info-light-3)]">
      <CircleCloseFilled />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.item-selecter-button {
  width: 40px;
  height: 40px;
  padding: 4px;
  border-radius: 4px;
  user-select: none;
  content-visibility: auto;

  &:hover {
    background-color: var(--el-color-info-light-9);
  }
  &:active {
    background-color: var(--el-color-info-light-8);
  }
}
</style>
