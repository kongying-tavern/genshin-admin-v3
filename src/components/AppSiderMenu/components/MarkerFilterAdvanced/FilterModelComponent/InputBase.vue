<script lang="ts" setup>
import type { MAFOptionInput } from '@/stores/types'
import { MarkerFilterInput } from '../../MarkerFilterComponent'

defineProps<{
  options: MAFOptionInput
  error?: boolean
}>()

const modelValue = defineModel<string>('modelValue', {
  required: true,
  default: '',
})
</script>

<template>
  <MarkerFilterInput v-model="modelValue" :placeholder="options?.placeholder" :error="error">
    <template v-if="$slots.prepend" #prepend>
      <slot name="prepend" />
    </template>
    <template v-if="$slots.append" #append>
      <slot name="append" />
    </template>
  </MarkerFilterInput>
</template>
