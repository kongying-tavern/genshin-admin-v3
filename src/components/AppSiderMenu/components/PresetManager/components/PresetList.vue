<script lang="ts" setup>
import type { FilterPreset } from '@/stores/types'
import { SelectList } from '../../SelectList'

withDefaults(
  defineProps<{
    title?: string
    list: FilterPreset[]
    disabled?: boolean
  }>(),
  {
    title: '',
    list: () => [],
    disabled: false,
  },
)

const presetName = defineModel<string>('presetName', {
  default: '',
})

const selectedPresetName = computed<string>({
  get: () => presetName.value ?? '',
  set: value => (presetName.value = value ?? ''),
})
</script>

<template>
  <div class="flex flex-col h-full gap-3">
    <div class="flex items-center gap-1">
      <div v-if="title" class="text-white whitespace-nowrap">· {{ title }}</div>
      <div class="flex-auto">
        <slot name="header-left" />
      </div>
      <div class="flex-none">
        <slot name="header-right" />
      </div>
    </div>

    <el-scrollbar class="flex-1">
      <SelectList
        v-model="selectedPresetName"
        class="h-full max-h-0"
        :list="list"
        value-key="name"
        :disabled="disabled"
      >
        <template #default="{ item, isActived }">
          <div :title="item.name" class="w-full flex justify-between items-center overflow-hidden">
            <div class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
              {{ item.name }}
            </div>
            <div
              v-if="item.type === 'advanced'"
              class="flex-shrink-0 rounded text-xs px-1 py-0.5 text-white"
              :class="isActived ? 'bg-[#3E4556]' : 'bg-[#111821]'"
              title="该预设为高级筛选的预设"
            >
              Pro
            </div>
          </div>
        </template>
      </SelectList>
    </el-scrollbar>
  </div>
</template>
