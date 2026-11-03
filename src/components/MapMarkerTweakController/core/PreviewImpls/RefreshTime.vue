<script setup lang="ts">
import { useRefreshTime } from '@/hooks'

const props = defineProps<{
  value?: number | string
}>()

const { refreshTimeType, isCustom, humanFriendlyTimeText } = useRefreshTime(
  computed(() => Number(props.value)),
)
</script>

<template>
  <div class="common-text h-full overflow-hidden text-xs py-1">
    <div class="text-wrapper">
      {{ isCustom ? humanFriendlyTimeText : refreshTimeType }}
    </div>
  </div>
</template>

<style scoped>
.text-wrapper {
  text-align: left;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  white-space: normal;
  overflow: hidden;
}
</style>
