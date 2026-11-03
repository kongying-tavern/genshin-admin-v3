<template>
  <div class="win-dialog">
    <slot name="default" />
  </div>
</template>

<style scoped>
.win-dialog {
  @apply overflow-hidden
    flex flex-col
    bg-[var(--el-fill-color-light)]
    border border-[var(--el-color-primary-light-9)] rounded-lg;
}
</style>
