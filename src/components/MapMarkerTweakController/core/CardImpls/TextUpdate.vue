<script setup lang="ts">
import type { ModifierConstructorOptions } from '..'
import type { TextModifierProps } from '../modifiers'
import type { TweakConfigVo } from '@/api/alova/globals'

defineProps<{
  options: ModifierConstructorOptions<TextModifierProps>
}>()

const modelValue = defineModel<Required<TweakConfigVo>['meta']>('modelValue', {
  required: true,
  default: {},
})

const text = computed<string>({
  get: () => {
    return `${modelValue.value.value ?? ''}`
  },
  set: newText => {
    modelValue.value = {
      ...modelValue.value,
      value: newText as unknown as object,
    }
  },
})
</script>

<template>
  <el-input
    v-model="text"
    placeholder="请输入文本..."
    clearable
    type="textarea"
    :autosize="{ minRows: 2, maxRows: 4 }"
  />
</template>
