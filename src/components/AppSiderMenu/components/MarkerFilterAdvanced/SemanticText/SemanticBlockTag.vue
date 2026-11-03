<script lang="ts" setup>
import type { MAFSemanticUnit } from '@/stores/types'

defineProps<{
  option: MAFSemanticUnit
}>()
</script>

<template>
  <span class="semantic-block sem-tag">
    {{ option.text ?? '' }}
  </span>
</template>

<style lang="scss" scoped>
.sem-tag {
  display: inline-block !important;
  background-color: var(--gs-color-cancel);
  border-radius: 0.4rem;
  border: 1px solid #ccc;
  color: #fff;
  font-weight: normal;
  padding: 0 0.4rem;
  margin: 0 0.05rem;
}
</style>
