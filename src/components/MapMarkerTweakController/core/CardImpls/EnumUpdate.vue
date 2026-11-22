<script setup lang="ts" generic="T">
import { useWindowPopupTarget } from '@/components/AppWindow/hooks/useWindowPopup'
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
const popupTarget = useWindowPopupTarget()
</script>

<template>
  <el-select-v2 :append-to="popupTarget" v-model="enumValue" :options="options.options" />
</template>
