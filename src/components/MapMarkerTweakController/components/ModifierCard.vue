<script setup lang="ts">
import type { Modifier } from '../core'
import type { TweakConfigVo } from '@/api/alova/globals'
import { Delete } from '@element-plus/icons-vue'

const props = defineProps<{
  index: number
  modifier: Modifier
}>()

defineEmits<{
  remove: []
}>()

const modelValue = defineModel<Required<TweakConfigVo>['meta']>('modelValue', {
  required: true,
})

const selectedIndex = defineModel<number>('selectedIndex', {
  required: true,
})

const activeModifier = () => {
  if (props.index === selectedIndex.value) return
  selectedIndex.value = props.index
}
</script>

<template>
  <Suspense>
    <div
      class="modifier-card"
      :class="{ 'is-active': index === selectedIndex }"
      @click="activeModifier"
    >
      <div class="card-title">
        <div
          class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-xs px-1"
          :title="modifier.options.label"
        >
          {{ `${index + 1}. ${modifier.options.label} - ${modifier.typeLabel}` }}
        </div>
        <div class="flex-shrink-0">
          <el-button
            text
            type="danger"
            :icon="Delete"
            size="small"
            style="
              --el-fill-color-light: var(--el-color-danger-light-7);
              --el-fill-color: var(--el-color-danger-light-9);
              padding: 5px 6px;
            "
            @click.stop="() => $emit('remove')"
          />
        </div>
      </div>
      <div class="card-content">
        <component :is="modifier.card" v-model="modelValue" :options="modifier.options" />
      </div>
    </div>

    <template #fallback>
      <div>加载中...</div>
    </template>
  </Suspense>
</template>

<style scoped>
.modifier-card {
  --border-color: var(--el-border-color);
  --title-bg: var(--el-color-primary-light-9);

  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;

  &.is-active {
    --border-color: var(--el-color-primary);
    --title-bg: var(--el-color-primary-light-7);
  }
}

.card-title {
  background: var(--title-bg);
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--el-text-color-primary);
  padding: 2px;
}

.card-content {
  padding: 8px;
}
</style>
