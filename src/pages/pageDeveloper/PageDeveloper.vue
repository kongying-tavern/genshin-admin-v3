<script setup lang="ts">
import { useFetchHook } from '@/hooks'
import { useDadianStore } from '@/stores'

const dadianStore = useDadianStore()

const { refresh: refreshApp, loading: refreshLoading } = useFetchHook({
  onRequest: () => Apis.app.triggerAppUpdate(),
})

const showDadianJson = () => {
  // oxlint-disable-next-line no-console
  console.log('[DadianJSON]', dadianStore.raw)
}
</script>

<template>
  <div class="w-full h-full overflow-hidden text-sm">
    <div class="utilbar">
      <el-text class="flex-1"> 发送刷新信号，将会导致所有在线用户刷新页面 </el-text>
      <el-button class="shrink-0" :loading="refreshLoading" @click="refreshApp">
        刷新应用
      </el-button>
    </div>

    <div class="utilbar">
      <el-text class="flex-1"> 在控制台打印地图配置 </el-text>
      <el-button @click="showDadianJson"> 查看地图配置 </el-button>
    </div>

    <div class="utilbar">
      <el-text class="flex-1"> 从本地文件加载测试用的地图配置（会经过校验） </el-text>
      <el-button @click="dadianStore.loadDadianJSON"> 加载地图配置 </el-button>
    </div>

    <div class="utilbar">
      <el-text class="flex-1"> 恢复为当前订阅的地图配置 </el-text>
      <el-button @click="dadianStore.update"> 恢复地图配置 </el-button>
    </div>
  </div>
</template>

<style scoped>
.utilbar {
  @apply m-2 p-2 flex justify-between items-center gap-2 rounded-lg border border-[var(--el-color-info-light-5)];
}
</style>
