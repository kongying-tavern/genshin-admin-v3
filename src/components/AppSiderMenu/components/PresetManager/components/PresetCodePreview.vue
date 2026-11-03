<script lang="ts" setup>
import type { FilterConditions } from '../types'
import { DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { isNil } from 'lodash'
import { GSButton } from '@/components'
import { usePresetZip } from '../hooks'

const props = withDefaults(
  defineProps<{
    conditions: FilterConditions | null
    title?: string
    tip?: string
  }>(),
  {
    conditions: null,
    title: '',
    tip: '',
  },
)

const { shareCode } = usePresetZip(toRef(props, 'conditions'))

const displayShareCode = computed(() => (isNil(props.conditions) ? '' : shareCode.value))

const copyCode = async () => {
  if (!displayShareCode.value) return
  await navigator.clipboard.writeText(displayShareCode.value)
  ElMessage.success({
    message: '分享码已复制到剪贴板',
  })
}
</script>

<template>
  <div class="flex items-center gap-2 pb-2">
    <div v-if="title" class="text-white pr-1">· {{ title }}</div>
    <GSButton size="small" title="复制分享码" :disabled="!displayShareCode" @click="copyCode()">
      <template #icon>
        <el-icon color="var(--gs-color-success)">
          <DocumentCopy />
        </el-icon>
      </template>
    </GSButton>
  </div>

  <div v-if="tip" class="bg-[#eacd96] mb-2 py-1 text-center text-[#232d3d]">
    {{ tip }}
  </div>

  <el-scrollbar class="flex-1 overflow-hidden">
    <div
      class="text-wrap break-all max-h-0 pr-1 share-code-text"
      :class="{ 'text-center': !displayShareCode }"
    >
      {{ displayShareCode || '暂无分享码' }}
    </div>
  </el-scrollbar>
</template>

<style scoped lang="scss">
.share-code-text {
  font-variant-emoji: text;
}
</style>
