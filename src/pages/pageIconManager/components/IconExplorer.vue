<script setup lang="ts">
import type { IconVo } from '@/api/alova/globals.js'
import { AppVirtualTable } from '@/components'
import IconImage from './IconImage.vue'

defineProps<{
  data: IconVo[]
}>()

const ICON_SIZE = 100

const activedIcon = defineModel<number | undefined>('activedItem', {
  required: true,
})
</script>

<template>
  <div
    class="border-r-[1px] border-[var(--el-border-color-light)] h-full overflow-hidden"
    element-loading-text="正在处理..."
  >
    <AppVirtualTable :data="data" :cached-rows="1" :item-height="ICON_SIZE" :item-width="ICON_SIZE">
      <template #default="{ item: icon }">
        <div
          class="grid-item"
          :title="icon.tag"
          :class="{
            'is-actived': icon.id === activedIcon,
          }"
          @click="activedIcon = icon.id"
        >
          <IconImage :url="icon.url" :alt="icon.tag" />
          <div class="item-label">
            {{ icon.tag }}
          </div>
        </div>
      </template>
    </AppVirtualTable>
  </div>
</template>

<style scoped>
.grid-item {
  --bg-color: transparent;

  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  overflow: hidden;
  border-radius: 6px;
  background-color: var(--bg-color);
  transition: all ease 100ms;
  border: 1px solid transparent;
  background-clip: padding-box;

  &.is-actived {
    --bg-color: var(--el-color-primary-light-7);
    border-radius: 4px;
  }

  &:not(.is-actived):hover {
    --bg-color: var(--el-color-primary-light-9);
  }

  &:not(.is-actived):active {
    --bg-color: var(--el-color-primary-light-7);
    border-radius: 4px;
  }
}

.item-label {
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: center;
  padding: 8px;
  color: var(--el-text-color-primary);
}
</style>
