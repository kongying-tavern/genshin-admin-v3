<script setup lang="ts">
import { IconLoading } from '@/components/AppIcons'

const DOCUMENT_URL = import.meta.env.VITE_DOCUMENT_URL

const isLoaded = ref(false)
const handleLoad = () => {
  isLoaded.value = true
}
</script>

<template>
  <div class="w-full h-full overflow-hidden">
    <div
      v-show="!isLoaded"
      class="w-full h-full grid place-content-center place-items-center gap-2"
    >
      <el-icon size="36">
        <IconLoading />
      </el-icon>
      <div>正在加载文档</div>
    </div>
    <iframe
      v-show="isLoaded"
      :src="DOCUMENT_URL"
      class="w-full h-full"
      referrerpolicy="origin"
      @load="handleLoad"
    />
  </div>
</template>
