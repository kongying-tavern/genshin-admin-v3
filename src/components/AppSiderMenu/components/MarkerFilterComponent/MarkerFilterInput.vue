<script lang="ts" setup>
defineProps<{
  disabled?: boolean
  error?: boolean
  placeholder?: string
}>()

const modelValue = defineModel<string>('modelValue', {
  required: true,
  default: '',
})
</script>

<template>
  <div class="condition-unit" :class="{ disabled }">
    <div
      class="condition-unit-input__inner"
      :class="[error ? 'ring-2 ring-offset-0 ring-[#E6455F]' : '']"
    >
      <template v-if="$slots.prepend">
        <div class="condition-unit-input__separator condition-unit-input__prepend">
          <slot name="prepend" />
        </div>
      </template>
      <input
        v-model="modelValue"
        class="condition-unit-input__internal"
        :placeholder="placeholder"
        :disabled="disabled"
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
