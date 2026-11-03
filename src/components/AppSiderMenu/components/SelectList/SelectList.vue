<script
  lang="ts"
  setup
  generic="T extends Record<string, any>, LK extends string, V extends unknown"
>
import { get } from 'lodash'

const props = defineProps<{
  disabled?: boolean
  list: T[]
  valueKey: LK
  multiple?: boolean
}>()

const emits = defineEmits<{
  change: [v?: V | V[]]
}>()

const modelValue = defineModel<V | V[] | null>('modelValue', {
  required: false,
  default: null,
})

const isValueEqual = (v: V, obj: T) =>
  JSON.stringify(v) === JSON.stringify(get(obj, props.valueKey))

const isActived = (targetOpt: T) =>
  !props.multiple
    ? isValueEqual(modelValue.value as V, targetOpt)
    : ((modelValue.value ?? []) as V[]).findIndex(value => isValueEqual(value, targetOpt)) > -1

const patchValue = (patchOpt: T) => {
  if (props.disabled) return

  // 单选
  if (!props.multiple) {
    const optValue = get(patchOpt, props.valueKey)
    modelValue.value = optValue !== modelValue.value ? optValue : null
    emits('change', optValue)
  }
  // 多选
  else {
    const shallowCopyValue = [...((modelValue.value ?? []) as V[])]
    const optValue = get(patchOpt, props.valueKey)
    const findIndex = shallowCopyValue.findIndex(value => value === optValue)
    if (findIndex > -1) shallowCopyValue.splice(findIndex, 1)
    else shallowCopyValue.push(optValue)
    modelValue.value = shallowCopyValue
    emits('change', shallowCopyValue)
  }
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-for="item in list"
      :key="`${get(item, valueKey as keyof T)}`"
      class="condition-row"
      :class="{
        actived: isActived(item),
      }"
      @click="() => patchValue(item)"
    >
      <slot name="icon" :item="item" />
      <slot :item="item" :is-actived="isActived(item)" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.condition-row {
  display: flex;
  padding: 16px;
  background: #202d3f;
  outline: 2px solid #363f4a;
  outline-offset: -4px;
  display: flex;
  border-radius: 8px;
  transition: all linear 50ms;
  user-select: none;
  font-size: 16px;
  cursor: pointer;

  &:not(.actived):hover {
    outline-color: #fff;
    outline-offset: -2px;
  }

  &:not(.actived):active {
    outline-offset: -4px;
  }

  &.actived {
    background: #f3e2bf;
    color: #202d3f;
  }
}
</style>
