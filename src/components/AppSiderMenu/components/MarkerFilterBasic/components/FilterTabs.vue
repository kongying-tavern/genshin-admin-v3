<script setup lang="ts">
const slots = defineSlots<{
  default: () => VNode[]
}>()

const isTabPanel = (vnode: VNode) => {
  const { type } = vnode
  if (typeof type !== 'object') return false
  if (!('name' in type)) return false
  return type.name === 'FilterTabPanel'
}

const modelValue = defineModel<number>('modelValue', {
  required: true,
})

provide('modelValue', modelValue)

const tabPanels = computed(() => slots.default().filter(isTabPanel))
</script>

<template>
  <div class="flex flex-col overflow-hidden">
    <div class="filter-tabs font-[HYWenHei-85W]">
      <template v-for="panel in tabPanels" :key="panel.props!.value">
        <div
          class="filter-tab"
          :class="{ actived: modelValue === panel.props!.value }"
          @click="modelValue = panel.props!.value"
        >
          <div class="w-full whitespace-nowrap text-ellipsis overflow-hidden">
            {{ panel.props!.label }}
          </div>
          <div class="w-full whitespace-nowrap text-ellipsis overflow-hidden text-sm">
            {{ panel.props!.content }}
          </div>
        </div>
      </template>
    </div>

    <div class="flex-1 overflow-hidden">
      <slot name="default" />
    </div>
  </div>
</template>

<style scoped>
.filter-tabs {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #263240;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 4px;
    background: rgb(100 100 100 / 0.6);
  }

  .filter-tab {
    --icon-scale: 1;
    --bg-color: transparent;
    --underline-scale: 0;

    flex: 1;
    padding: 8px 0 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    transition: all ease 150ms;
    user-select: none;
    position: relative;
    color: #d3bc8e;
    text-align: center;
    background: linear-gradient(
      to bottom,
      var(--bg-color) calc(100% - 4px),
      transparent calc(100% - 4px)
    );
    overflow: hidden;
    cursor: pointer;

    &:not(.actived):hover {
      filter: brightness(110%);
    }
    &:not(.actived):active {
      filter: brightness(90%);
    }
    &.actived {
      --underline-scale: 1;
      --bg-color: #ece5d8;
      color: #000;
    }
    &::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 4px;
      left: 0;
      bottom: 0;
      background: #d3bc8e;
      transition: all ease 150ms;
      scale: var(--underline-scale) 1;
    }
  }
}
</style>
