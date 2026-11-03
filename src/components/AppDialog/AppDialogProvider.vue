<script lang="ts" setup>
import { context } from './context'
</script>

<template>
  <el-dialog
    :model-value="context.visible.value"
    v-bind="{ ...context.current.value?.config }"
    destroy-on-close
    append-to-body
    class="custom-dialog"
    :data-dialog-id="context.current.value?.id"
    @closed="() => context.afterClosed()"
  >
    <component
      :is="context.current.value.component"
      v-if="context.current.value"
      v-bind="{ ...context.current.value.props }"
      v-on="context.current.value.listeners"
      @close="
        (payload: unknown) =>
          context.current.value?.listeners.close?.(payload)
          ?? context.close(context.current.value?.id, payload)
      "
    />
  </el-dialog>
</template>

<style>
.custom-dialog.el-dialog {
  --el-dialog-border-radius: 8px;
  --el-dialog-padding-primary: 0;

  background: transparent;

  .el-dialog__header {
    display: none;
  }
}
</style>
