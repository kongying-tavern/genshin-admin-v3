<script lang="ts" setup>
import type {
  MAFMetaDummy,
  MAFOptionRange,
  MAFOptionSwitch,
  MAFValueBoolean,
  MAFValueNumberRange,
} from '@/stores/types'
import { MarkerFilterButton } from '../../MarkerFilterComponent'
import { NumberRangeBase } from '../FilterModelComponent'

defineProps<{
  options: MAFOptionSwitch & MAFOptionRange
  meta: MAFMetaDummy
}>()

const modelValue = defineModel<MAFValueBoolean & MAFValueNumberRange>('modelValue', {
  required: false,
  default: {
    b: false,
    nMin: null,
    nMax: null,
  },
})

const toggleMatchMode = () => {
  modelValue.value.b = !modelValue.value.b
}

const modeTip = computed(() =>
  modelValue.value.b ? '点位物品关联全部满足计数区间' : '点位物品关联部分满足计数区间',
)
</script>

<template>
  <div class="flex-auto flex gap-1 items-center">
    <MarkerFilterButton theme="light" @click="toggleMatchMode">
      <template #default>
        <el-tooltip placement="top-start" effect="light" :content="modeTip">
          {{ modelValue.b ? options.textActive : options.textInactive }}
        </el-tooltip>
      </template>
    </MarkerFilterButton>
    <span class="flex-none">物品计数</span>
    <NumberRangeBase
      v-model:min="modelValue.nMin"
      v-model:max="modelValue.nMax"
      class="flex-auto"
      :options="options"
    />
  </div>
</template>
