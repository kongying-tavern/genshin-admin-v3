<script setup lang="ts">
import { useWindowPopupTarget } from '@/components/AppWindow/hooks/useWindowPopup'
import type { TweakConfigVo } from '@/api/alova/globals'
import { AppTimeSelect } from '@/components'
import { useRefreshTime } from '@/hooks'

const modelValue = defineModel<Required<TweakConfigVo>['meta']>('modelValue', {
  required: true,
  default: {},
})

const time = computed<number>({
  get: () => {
    return Number(modelValue.value.value) || 0
  },
  set: newTime => {
    modelValue.value = {
      ...modelValue.value,
      value: newTime as unknown as object,
    }
  },
})

const { refreshTimeType, refreshTimeTypeOptions, isCustom } = useRefreshTime(time)
const popupTarget = useWindowPopupTarget()
</script>

<template>
  <div class="w-full flex flex-col gap-2">
    <el-select-v2
      :append-to="popupTarget"
      v-model="refreshTimeType"
      :options="refreshTimeTypeOptions"
    />
    <AppTimeSelect v-model="time" :disabled="!isCustom" disabled-autofucus class="h-8 flex-1" />
  </div>
</template>
