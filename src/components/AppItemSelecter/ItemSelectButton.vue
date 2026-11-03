<script lang="ts" setup>
import type { ItemVo } from '@/api/alova/globals'
import { AppIconTagRenderer } from '@/components'

defineProps<{
  item: ItemVo
  actived: boolean
  src?: string
  mapping?: [number, number]
}>()
</script>

<template>
  <div
    v-bind="$attrs"
    :title="item.name"
    class="item-selecter-button flex"
    :class="{ 'is-actived': actived }"
  >
    <el-icon
      v-show="actived"
      class="top-0 right-0 bg-[var(--el-color-primary-light-5)] rounded-[0_0_0_4px] p-0.5 pointer-events-none"
      style="position: absolute"
      color="var(--el-color-primary-dark-2)"
      :size="16"
    >
      <Select />
    </el-icon>

    <AppIconTagRenderer :src="src" :mapping="mapping" class="w-6 h-6 flex-shrink-0" />

    <el-text truncated size="small">
      {{ item.name }}
    </el-text>

    <slot name="append" />
  </div>
</template>

<style scoped>
.item-selecter-button {
  height: 36px;
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  user-select: none;
  content-visibility: auto;
  position: relative;

  &:hover {
    background-color: var(--el-color-info-light-9);
  }

  &:active {
    background-color: var(--el-color-info-light-8);
  }

  &.is-actived {
    &::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      left: 0;
      top: 0;
      border-width: 2px;
      border-color: var(--el-color-primary-light-5);
      border-style: solid;
      border-radius: 4px;
      pointer-events: none;
    }
  }
}
</style>
