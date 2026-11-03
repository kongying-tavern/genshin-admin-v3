<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  url?: string
  alt?: string
}>()

const isLoaded = ref(false)

watch(
  () => props.url,
  () => {
    isLoaded.value = false
  },
)

const handleLoad = () => {
  isLoaded.value = true
}

const handleError = () => {
  isLoaded.value = true
}
</script>

<template>
  <div class="icon-container select-none">
    <div v-if="!props.url || !isLoaded" class="icon-skeleton" />
    <img
      v-if="props.url"
      :key="props.url"
      draggable="false"
      :src="props.url"
      :alt="props.alt"
      class="icon-image"
      crossorigin=""
      :class="{ 'opacity-0': !isLoaded }"
      loading="lazy"
      @load="handleLoad"
      @error="handleError"
    />
  </div>
</template>

<style scoped>
.icon-container {
  width: 48px;
  height: 48px;
}

.icon-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: opacity 0.3s ease;
}

.icon-skeleton {
  width: 48px;
  height: 48px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
