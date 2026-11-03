<script setup lang="ts">
import { useFetchHook, useGlobalDialog } from '@/hooks'
import PushConfirm from './components/PushConfirm.vue'

const { DialogService } = useGlobalDialog()

const { loading, refresh: pushUpdate } = useFetchHook({
  onRequest: () => Apis.app.triggerAppUpdate(),
})

const confirmPush = async () => {
  const isConfirm = await DialogService.config({
    alignCenter: true,
  })
    .open(PushConfirm)
    .afterClosed<boolean>()
  if (!isConfirm) return
  await pushUpdate()
}
</script>

<template>
  <el-button
    class="app-setting-button"
    text
    size="large"
    style="--el-border-radius-base: 8px; padding: 8px 12px"
    :loading="loading"
    @click="confirmPush"
  >
    <el-icon :size="20">
      <Lightning />
    </el-icon>
  </el-button>
</template>
