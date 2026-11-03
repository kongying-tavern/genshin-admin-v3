<script lang="ts" setup generic="T, V extends string | number | boolean">
import { ElSegmented } from 'element-plus'

interface NormalizedOption {
  label: string
  value: V
}

const props = defineProps<{
  size: '' | 'large' | 'default' | 'small'
  options: T[]
  getLabel: (option: T) => string
  getValue: (option: T) => V
}>()

const modelValue = defineModel<V>('modelValue')

const componentOptions = computed<NormalizedOption[]>(() => {
  return props.options.map(option => {
    const label = props.getLabel(option)
    const value = props.getValue(option)
    return { label, value } satisfies NormalizedOption
  })
})
</script>

<template>
  <ElSegmented v-model="modelValue" class="gs-segmented" :size="size" :options="componentOptions" />
</template>

<style lang="scss" scoped>
.gs-segmented {
  --gs-segment-dark: #353d4f;
  --gs-segment-light: #fff8de;
  --el-segmented-color: var(--gs-segment-light);
  --el-segmented-bg-color: var(--gs-segment-dark);
  --el-segmented-item-hover-bg-color: transparent;
  --el-segmented-item-hover-color: color-mix(in srgb, var(--gs-segment-light), #fff 50%);
  --el-segmented-item-selected-color: var(--gs-segment-dark);
  --el-segmented-item-selected-bg-color: color-mix(
    in srgb,
    var(--gs-segment-light),
    transparent 10%
  );
  --el-border-radius-base: 50cqh;
}
</style>
