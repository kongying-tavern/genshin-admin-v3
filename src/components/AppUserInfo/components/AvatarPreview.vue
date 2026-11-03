<script lang="ts" setup>
import { Loading } from '@element-plus/icons-vue'

const props = defineProps<{
  src?: HTMLImageElement['src']
}>()

const loading = ref(true)
watch(
  () => props.src,
  () => {
    loading.value = true
  },
)
</script>

<template>
  <div class="avatar-preview w-full grid place-items-center">
    <template v-if="src">
      <el-icon v-show="loading" :size="32" class="animate-spin">
        <Loading />
      </el-icon>

      <img
        v-show="!loading"
        :src="src"
        crossorigin=""
        referrerpolicy="no-referrer"
        class="w-full h-full object-contain"
        @load="loading = false"
        @error="loading = false"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.avatar-preview {
  width: 112px;
  height: 112px;
  background: #d19d78;
  border: 6px solid #5d6a81;
  border-radius: 50%;
  outline: 2px solid #d4be92;
  overflow: hidden;
}
</style>
