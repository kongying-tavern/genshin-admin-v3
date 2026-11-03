<script lang="ts" setup>
import type { MAFSemanticUnit } from '@/stores/types'

defineProps<{
  option: MAFSemanticUnit
}>()
</script>

<template>
  <span class="semantic-block sem-highlight">
    {{ option.text ?? '' }}
  </span>
</template>

<style lang="scss" scoped>
.sem-highlight {
  vertical-align: middle;
  min-height: 1lh;
  border-bottom: var(--gs-color-cancel) 0.2rem dotted;
  padding: 0 0.3rem;
  margin: 0 0.2rem;
  background-color: #f5e192;

  &:hover {
    background-color: rgb(250, 219, 81);
  }
}
</style>
