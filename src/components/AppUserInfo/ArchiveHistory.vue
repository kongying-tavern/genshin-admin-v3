<script lang="ts" setup>
import type { ArchiveData } from '@/stores'
import dayjs from 'dayjs'

const props = defineProps<{
  modelValue?: ArchiveData
  data: ArchiveData[]
}>()

const emits = defineEmits<{
  'update:modelValue': [history?: ArchiveData]
}>()

const format = (timestamp: number) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
}

const toggleSelectItem = (history: ArchiveData) => {
  emits(
    'update:modelValue',
    props.modelValue?.historyIndex === history.historyIndex ? undefined : history,
  )
}
</script>

<template>
  <div class="flex flex-col gap-2 select-none">
    <div
      v-for="history in data"
      :key="history.timestamp"
      class="history-item flex cursor-pointer transition-all rounded-lg p-2"
      :class="{ 'is-selected': history.historyIndex === modelValue?.historyIndex }"
      @click="() => toggleSelectItem(history)"
    >
      <span class="flex-1">{{ format(history.timestamp) }}</span>
      <el-tag size="small" type="info" effect="dark">
        {{ history.body.Data_KYJG.size }}
      </el-tag>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.history-item {
  --outline-color: transparent;
  --outline-offset: -4px;
  --bg-color: #303544;
  --text-color: #fff;

  border: 1px solid gray;
  outline: 1px solid var(--outline-color);
  outline-offset: var(--outline-offset);
  background-color: var(--bg-color);
  color: var(--text-color);

  &:hover {
    --outline-color: #ccbb99;
    --outline-offset: 0px;
  }

  &:active {
    --bg-color: #fdfaec;
    --text-color: #1c5563;
  }

  &.is-selected {
    --bg-color: #fdfaec;
    --text-color: #1c5563;
  }
}
</style>
