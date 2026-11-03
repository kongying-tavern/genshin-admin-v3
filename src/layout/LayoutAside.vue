<template>
  <div class="layout-aside" v-bind="$attrs">
    <div class="layout-aside__header">
      <slot name="header" />
    </div>

    <div class="layout-aside__main">
      <slot name="default" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.layout-aside {
  width: var(--c-aside-width);
  grid-row-start: span 2;
  box-shadow: var(--c-aside-shadow);
  background-color: var(--el-bg-color);
  transition:
    width 0.2s ease,
    background-color 0.2s;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .layout-aside__header {
    height: var(--c-header-height);
    line-height: var(--c-header-height);
  }

  .layout-aside__main {
    flex: 1;
    overflow: auto;
  }
}
</style>
