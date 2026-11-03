<script setup lang="ts">
import dayjs from 'dayjs'

const props = defineProps<{
  data: Socket.DataEventRecord<'MarkerTweaked'>
}>()

const markers = computed(() => {
  const [markerList] = props.data.args
  return markerList ?? []
})
</script>

<template>
  <div class="p-2 rounded-lg select-none">
    <div class="text-[var(--el-text-color-secondary)] mb-1">批量修改</div>

    <div
      class="p-2 px-3 rounded border-l-[2px] border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]"
    >
      <div class="font-bold">修改了 {{ markers.length }} 个点位</div>
    </div>

    <div class="text-[var(--el-text-color-secondary)] mt-1">
      {{ dayjs(data.time).format('YYYY-MM-DD HH:mm:ss') }}
    </div>
  </div>
</template>
