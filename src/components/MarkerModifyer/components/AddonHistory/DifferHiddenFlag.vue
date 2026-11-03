<script setup lang="ts">
import { Right } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { HIDDEN_FLAG_NAME_MAP } from '@/shared'

const props = withDefaults(
  defineProps<{
    history?: number
    current?: number
  }>(),
  {
    history: 0,
    current: 0,
  },
)

const currentFlag = computed(() => HIDDEN_FLAG_NAME_MAP[`${props.current}`])

const historyFlag = computed(() => HIDDEN_FLAG_NAME_MAP[`${props.history}`])
</script>

<template>
  <div class="flex items-center gap-1">
    <div class="name-tag">
      {{ historyFlag }}
    </div>

    <ElIcon class="shrink-0">
      <Right />
    </ElIcon>

    <div class="name-tag">
      {{ currentFlag }}
    </div>
  </div>
</template>

<style scoped>
.name-tag {
  @apply flex-1 p-1
    flex justify-center
    rounded-sm
    text-xs
    bg-[var(--el-color-info-light-9)];
}
</style>
