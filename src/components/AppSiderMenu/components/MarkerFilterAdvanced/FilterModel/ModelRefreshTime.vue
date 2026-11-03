<script lang="ts" setup>
import type {
  MAFMetaRefreshTime,
  MAFOptionRange,
  MAFOptionSelect,
  MAFValueNumberRange,
} from '@/stores/types'
import { IconTimer } from '@/components/AppIcons'
import { MarkerFilterButton } from '../../MarkerFilterComponent'
import { NumberRangeBase, SelectBase } from '../FilterModelComponent'

const props = defineProps<{
  options: MAFOptionRange & MAFOptionSelect<{ label: string; value: number }>
  meta: MAFMetaRefreshTime
}>()

const modelValue = defineModel<MAFValueNumberRange>('modelValue', {
  required: false,
  default: {
    nMin: null,
    nMax: null,
  },
})

const selectValue = computed<number | null>({
  get: () => (props.meta.isCustom ? 12 * 3600 * 1000 : modelValue.value.nMin),
  set: value => {
    if (Number.isFinite(value) && Number(value) <= 0) {
      modelValue.value.nMin = value
      modelValue.value.nMax = value
    } else {
      modelValue.value.nMin = 12
      modelValue.value.nMax = 12
    }
  },
})

const selectTag = computed(() => {
  if (props.meta.isCustom) return ''
  return props.meta.tagNameMap[selectValue.value ?? 0]
})
</script>

<template>
  <div class="flex-auto flex gap-1 items-center">
    <span class="flex-none">刷新时间</span>
    <SelectBase v-model="selectValue" :options="options">
      <MarkerFilterButton theme="dark">
        <template #icon>
          <IconTimer />
        </template>
        <template v-if="selectTag" #default>
          {{ selectTag }}
        </template>
      </MarkerFilterButton>
    </SelectBase>
    <NumberRangeBase
      v-if="meta.isCustom"
      v-model:min="modelValue.nMin"
      v-model:max="modelValue.nMax"
      class="flex-auto"
      :options="options"
    >
      <template #append> h </template>
    </NumberRangeBase>
  </div>
</template>
