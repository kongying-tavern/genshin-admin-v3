<script setup lang="ts" generic="T">
import type { ModifierConstructorOptions } from '..'
import type { EnumModifierProps } from '../modifiers'
import type { TweakConfigVo } from '@/api/alova/globals'

defineProps<{
  options: ModifierConstructorOptions<EnumModifierProps<T>>
}>()

const modelValue = defineModel<Required<TweakConfigVo>['meta']>('modelValue', {
  required: true,
  default: {},
})

const enumValue = computed<T>({
  get: () => {
    return modelValue.value.value as T
  },
  set: value => {
    modelValue.value = {
      ...modelValue.value,
      value: value as object,
    }
  },
})
</script>

<template>
  <el-select-v2 v-model="enumValue" :options="options.options" />
</template>
