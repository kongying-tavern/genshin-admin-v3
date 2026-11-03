<script lang="ts" setup>
import { AppTimeSelect } from '@/components'
import { useRefreshTime } from '@/hooks'

const props = defineProps<{
  modelValue?: number
}>()

const emits = defineEmits<{
  'update:modelValue': [refreshTime?: number]
}>()

const refreshTime = computed({
  get: () => props.modelValue,
  set: v => emits('update:modelValue', v),
})

const { refreshTimeTypeOptions, refreshTimeType, isCustom } = useRefreshTime(refreshTime)
</script>

<template>
  <div class="w-full flex gap-2">
    <el-select-v2
      v-model="refreshTimeType"
      :options="refreshTimeTypeOptions"
      style="width: 140px"
    />
    <AppTimeSelect v-model="refreshTime" :disabled="!isCustom" class="h-8 flex-1" />
  </div>
</template>
