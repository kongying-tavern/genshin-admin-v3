<template>
  <div class="message-component-loading">Loading...</div>
</template>

<style scoped>
@property --anime-ratio {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

@keyframes loading-anime {
  from {
    --anime-ratio: 0%;
  }
  to {
    --anime-ratio: 100%;
  }
}

.message-component-loading {
  @apply p-2 text-[var(--el-text-color-primary)];
  background: linear-gradient(
    to right,
    var(--el-fill-color-lighter),
    var(--el-color-primary-light-7) var(--anime-ratio),
    var(--el-fill-color-lighter)
  );
  animation: loading-anime 1s ease-in-out infinite both alternate;
}
</style>
