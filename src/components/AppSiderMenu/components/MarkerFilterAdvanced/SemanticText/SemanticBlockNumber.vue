<script lang="ts" setup>
import type { MAFSemanticUnit } from '@/stores/types'

defineProps<{
  option: MAFSemanticUnit
}>()
</script>

<template>
  <span class="semantic-block sem-number font-['AsanaMath']">
    {{ option.text ?? '' }}
  </span>
</template>

<style lang="scss" scoped>
.sem-number {
  font-style: italic;
  font-size: 1.1rem;
  margin: 0 0.2rem;
}
</style>
