<script lang="ts" setup>
import type { MAFSemanticUnit } from '@/stores/types'

defineProps<{
  option: MAFSemanticUnit
}>()
</script>

<template>
  <span class="semantic-block sem-parenthesis font-['AsanaMath']">
    {{ option.text ?? '' }}
  </span>
</template>

<style lang="scss" scoped>
.sem-parenthesis {
  vertical-align: middle;
  font-size: 1.6rem;
  line-height: 1.6;
  font-weight: bold;
  margin: 0 0.2rem;
}
</style>
