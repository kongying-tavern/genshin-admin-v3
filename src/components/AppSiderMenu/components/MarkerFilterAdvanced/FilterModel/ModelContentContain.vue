<script lang="ts" setup>
import type { MAFMetaDummy, MAFOptionInput, MAFValueString } from '@/stores/types'
import { InputBase } from '../FilterModelComponent'

defineProps<{
  options: MAFOptionInput
  meta: MAFMetaDummy
}>()

const modelValue = defineModel<MAFValueString>('modelValue', {
  required: false,
  default: {
    s: '',
  },
})
</script>

<template>
  <div class="flex-auto flex gap-1 items-center">
    <span class="flex-none">内容包含</span>
    <InputBase v-model="modelValue.s" class="flex-auto" :options="options" />
  </div>
</template>
