<script lang="ts" setup>
import type { MAFSemanticUnit } from '@/stores/types'

defineProps<{
  option: MAFSemanticUnit
}>()
</script>

<template>
  <span class="semantic-block sem-regex font-['CascadiaMono']">
    <span class="text">{{ option.text ?? '' }}</span>
  </span>
</template>

<style lang="scss" scoped>
.sem-regex {
  font-weight: bolder;
  margin: 0.2rem;

  .text {
    color: #2d65cc;
  }

  &::before,
  &::after {
    content: '/';
    padding: 0 0.1rem;
    color: #808080;
  }
}
</style>
