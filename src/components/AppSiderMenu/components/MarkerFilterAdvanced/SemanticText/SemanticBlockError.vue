<script lang="ts" setup>
import type { MAFSemanticUnit } from '@/stores/types'
import { WarnTriangleFilled } from '@element-plus/icons-vue'

defineProps<{
  option: MAFSemanticUnit
}>()
</script>

<template>
  <span class="semantic-block sem-error">
    <el-icon class="icon" size="1.4rem">
      <WarnTriangleFilled />
    </el-icon>
    {{ option.text ?? '' }}
  </span>
</template>

<style lang="scss" scoped>
.sem-error {
  color: var(--gs-color-danger);
  margin: 0 0.2rem;

  .icon {
    vertical-align: middle;
  }
}
</style>
