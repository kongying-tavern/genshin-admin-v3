<script setup lang="ts">
const { APP_VERSION: version, APP_BRANCH: branch, APP_COMMIT_HASH: commitHash } = import.meta.env
</script>

<template>
  <div
    class="fixed left-0 bottom-0 w-full h-8 leading-8 px-4 font-[HYWenHei-85W] text-[var(--el-color-white)] text-sm overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none"
    style="-webkit-text-stroke: 2px #363d4d; paint-order: stroke"
  >
    {{ `${version.toUpperCase()}_${branch.toUpperCase()}_${commitHash.toUpperCase()}` }}
  </div>
</template>
