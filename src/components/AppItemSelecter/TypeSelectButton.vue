<script lang="ts" setup>
import type { ItemTypeVo } from '@/api/alova/globals'
import { AppIconTagRenderer } from '@/components'

withDefaults(
  defineProps<{
    itemType: ItemTypeVo
    nums?: number
    actived: boolean
    src?: string
    mapping?: [number, number]
  }>(),
  {
    nums: 0,
  },
)
</script>

<template>
  <div
    :title="itemType.name"
    :class="{ actived }"
    class="type-select-button flex items-center rounded p-1 mb-0.5 gap-1 relative"
  >
    <slot name="icon">
      <AppIconTagRenderer :src="src" :mapping="mapping" class="w-7 h-7 flex-shrink-0" />
    </slot>
    <div class="overflow-hidden text-ellipsis whitespace-nowrap text-xs">
      {{ itemType.name }}
    </div>
    <div
      v-show="nums > 0"
      class="min-w-[16px] px-0.5 rounded absolute top-0 right-0 grid place-content-center bg-[var(--el-color-primary-light-5)] text-xs text-[var(--el-text-color-regular)]"
    >
      {{ nums }}
    </div>
  </div>
</template>

<style scoped>
.type-select-button {
  &:not(.actived):hover {
    background-color: var(--el-color-primary-light-9);
  }
  &:not(.actived):active {
    background-color: var(--el-color-primary-light-7);
  }
  &.actived {
    background-color: var(--el-color-primary);
    color: var(--el-color-white);
  }
}
</style>
