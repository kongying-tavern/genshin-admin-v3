<script lang="ts" setup>
import type { MAFSemanticUnit } from '@/stores/types'

defineProps<{
  option: MAFSemanticUnit
}>()
</script>

<template>
  <span class="semantic-block sem-logic-operator">
    {{ option.text ?? '' }}
  </span>
</template>

<style lang="scss" scoped>
.sem-logic-operator {
  vertical-align: middle;
  color: #2283a7;
  margin: 0 0.2rem;
  font-size: 1.2rem;
}
</style>
