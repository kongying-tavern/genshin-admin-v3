<script lang="ts" setup>
const props = defineProps<{
  disabledMin?: boolean
  disabledMax?: boolean
  placeholderMin?: string
  placeholderMax?: string
  minValueMin?: number
  minValueMinInclude?: boolean
  minValueMax?: number
  minValueMaxInclude?: boolean
  maxValueMin?: number
  maxValueMinInclude?: boolean
  maxValueMax?: number
  maxValueMaxInclude?: boolean
}>()

const isValueNull = (
  value?: unknown,
  min?: number,
  minInclude?: boolean,
  max?: number,
  maxInclude?: boolean,
): boolean => {
  if (value === undefined || value == null || value?.toString() === '') return true
  const val: number = +value
  if (!Number.isFinite(val)) return true
  const minVal = min ?? Number.NEGATIVE_INFINITY
  const maxVal = max ?? Number.POSITIVE_INFINITY
  const gtMin = (minInclude ?? true) ? val >= minVal : val > minVal
  const ltMax = (maxInclude ?? true) ? val <= maxVal : val < maxVal
  return !(gtMin && ltMax)
}
const valueSetter = (
  value?: unknown,
  min?: number,
  minInclude?: boolean,
  max?: number,
  maxInclude?: boolean,
) => (isValueNull(value, min, minInclude, max, maxInclude) ? null : Number(value))

const modelValueMin = defineModel<number | null>('min', {
  required: false,
  default: null,
  get: value => value,
  set: value =>
    valueSetter(
      value,
      props.minValueMin,
      props.minValueMinInclude,
      props.minValueMax,
      props.minValueMaxInclude,
    ),
})
const modelValueMax = defineModel<number | null>('max', {
  required: false,
  default: null,
  get: value => value,
  set: value =>
    valueSetter(
      value,
      props.maxValueMin,
      props.maxValueMinInclude,
      props.maxValueMax,
      props.maxValueMaxInclude,
    ),
})
</script>

<template>
  <div class="condition-unit" :class="{ disabled: disabledMin && disabledMax }">
    <div class="condition-unit-input__inner">
      <template v-if="$slots.prepend">
        <div class="condition-unit-input__separator condition-unit-input__prepend">
          <slot name="prepend" />
        </div>
      </template>
      <input
        v-model="modelValueMin"
        class="condition-unit-input__internal"
        :placeholder="placeholderMin"
        :disabled="disabledMin"
      />
      <div class="condition-unit-input__sep">
        <slot name="separator"> - </slot>
      </div>
      <input
        v-model="modelValueMax"
        class="condition-unit-input__internal"
        :placeholder="placeholderMax"
        :disabled="disabledMax"
      />
      <template v-if="$slots.append">
        <div class="condition-unit-input__separator condition-unit-input__append">
          <slot name="append" />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use './MarkerFilterInput.scss' as style;
@include style.main;
</style>
