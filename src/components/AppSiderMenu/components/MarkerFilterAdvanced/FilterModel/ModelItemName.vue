<script lang="ts" setup>
import type { MAFMetaItemName, MAFOptionInput, MAFValueString } from '@/stores/types'
import { InputBase } from '../FilterModelComponent'

defineProps<{
  options: MAFOptionInput
  meta: MAFMetaItemName
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
    <span class="flex-none">物品名称</span>
    <InputBase v-model="modelValue.s" class="flex-auto" :options="options" />
  </div>
</template>
