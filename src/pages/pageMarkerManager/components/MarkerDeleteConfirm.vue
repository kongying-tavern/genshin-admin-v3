<script setup lang="ts">
import type { MarkerVo } from '@/api/alova/globals'
import { Check, Close, Delete } from '@element-plus/icons-vue'
import { WinDialog, WinDialogFooter, WinDialogTitleBar } from '@/components'
import { useFetchHook } from '@/hooks'
import { useMarkerStore } from '@/stores'

const props = defineProps<{
  title: string
  marker: MarkerVo
}>()

const emits = defineEmits<{
  success: []
  close: [boolean]
}>()

const markerStore = useMarkerStore()

const {
  loading,
  refresh: deleteMarker,
  onSuccess,
} = useFetchHook({
  onRequest: async (marker: MarkerVo) => {
    await markerStore.deleteMarker(marker.id!)
  },
})

onSuccess(() => {
  emits('success')
})

const cancel = () => {
  emits('close', false)
}

const confirm = async () => {
  await deleteMarker(props.marker)
  emits('close', true)
}
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar :loading="loading" @close="cancel">
      {{ title }}
    </WinDialogTitleBar>

    <div class="w-[300px] p-2 grid grid-rows-[auto_1fr] grid-cols-[auto_1fr] gap-2">
      <div class="row-span-2">
        <el-icon class="p-1" size="40" color="var(--el-color-danger)">
          <Delete />
        </el-icon>
      </div>
      <div>确实要永久性的删除此点位吗？</div>
      <div class="text-[var(--el-text-color-primary)]">
        <div>名称: {{ marker.markerTitle }}</div>
        <div>ID: {{ marker.id }}</div>
      </div>
    </div>

    <WinDialogFooter>
      <el-button :icon="Check" :loading="loading" type="danger" @click="confirm"> 是 </el-button>

      <el-button :icon="Close" :disabled="loading" @click="cancel"> 否 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
