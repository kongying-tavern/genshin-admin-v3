<script setup lang="ts">
import { Right } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { useRefreshTime } from '@/hooks'

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

const { humanFriendlyTimeText: currentTime } = useRefreshTime(computed(() => props.current))

const { humanFriendlyTimeText: historyTime } = useRefreshTime(computed(() => props.history))
</script>

<template>
  <div class="flex items-center gap-1">
    <div class="time-tag">
      {{ historyTime }}
    </div>

    <ElIcon class="shrink-0">
      <Right />
    </ElIcon>

    <div class="time-tag">
      {{ currentTime }}
    </div>
  </div>
</template>

<style scoped>
.time-tag {
  @apply flex-1 p-1
    flex justify-center
    rounded-sm
    text-xs
    bg-[var(--el-color-info-light-9)];
}
</style>
