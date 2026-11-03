<script lang="ts" setup>
defineProps<{
  src?: string
}>()
</script>

<template>
  <div
    class="w-8 h-8 rounded-full border border-[var(--el-color-info-light-5)] bg-[var(--el-color-info-light-7)] flex-shrink-0"
  >
    <img v-if="src" class="w-full h-full object-contain rounded" :src="src" crossorigin="" />
  </div>
</template>
