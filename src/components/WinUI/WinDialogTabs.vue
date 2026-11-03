<script setup lang="ts">
const props = defineProps<{
  options: { key: string; name: string }[]
  disabled?: boolean
}>()

const activedTabKey = defineModel<string>('modelValue', {
  required: true,
})

const setTabKey = (tabKey: string) => {
  if (props.disabled) return
  activedTabKey.value = tabKey
}
</script>

<template>
  <div class="win-tabs">
    <div
      v-for="tab in options"
      :key="tab.key"
      class="tab-item"
      :class="{
        actived: activedTabKey === tab.key,
      }"
      @click="() => setTabKey(tab.key)"
    >
      {{ tab.name }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.win-tabs {
  display: flex;
  margin: 8px 8px 0 8px;
  font-size: 12px;
  line-height: 16px;
  transform: translate(0, 1px);
}

.tab-item {
  border-width: 1px 0 1px 1px;

  @apply py-1 px-2 mt-0.5
    border-[var(--el-border-color)]
    bg-[var(--el-fill-color)]
    select-none
    relative;

  &.actived {
    border-width: 1px;
    + .tab-item {
      border-width: 1px 0px 1px 0px;
      &:last-of-type {
        border-width: 1px 1px 1px 0px;
      }
    }
    @apply bg-[var(--el-bg-color)] mt-0;
  }

  &:last-of-type {
    border-width: 1px;
  }

  &.actived::before {
    content: '';
    @apply w-full h-[1px]
      absolute left-0 bottom-0
      bg-[var(--el-bg-color)]
      translate-y-[1px];
  }

  &:not(.actived):hover {
    @apply bg-[var(--el-bg-color)];
  }
}
</style>
