<script lang="ts" setup>
import { GSDivider } from '.'

const props = withDefaults(
  defineProps<{
    modelValue: string
    tabs: { title: string; value: string }[]
    size?: 'small' | 'medium' | 'large'
    divider?: boolean
    theme?: 'light' | 'dark'
  }>(),
  {
    tabs: () => [],
    size: 'medium',
    divider: false,
    theme: 'light',
  },
)

const emits = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()
</script>

<template>
  <div
    v-if="tabs.length"
    class="gs-tab"
    :class="[`gs-tab--size-${size}`, `gs-tab--theme-${theme}`]"
  >
    <div class="gs-tab-title shrink-0">
      <div
        v-for="tab in tabs"
        :key="tab.value"
        class="gs-tab-title__item"
        :class="{ actived: tab.value === props.modelValue }"
        @click="() => emits('update:modelValue', tab.value)"
      >
        {{ tab.title }}
      </div>
    </div>

    <GSDivider v-if="divider" />

    <div class="gs-tab-content overflow-hidden">
      <KeepAlive>
        <template v-for="tab in tabs">
          <slot v-if="tab.value === modelValue" :key="tab.value" :name="tab.value" />
        </template>
      </KeepAlive>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.gs-tab {
  --tab-font-size: 20px;
  --tab-item-min-width: 150px;
  --tab-item-padding: 6px 24px;
  // light theme
  --tab-bg: #dccaa8;
  --tab-arrow-bg: #e2d3b8;
  --tab-border-color: transparent;
  --tab-text-color: #7f6b5b;
  --tab-hover-color: #fff;
  --tab-active-bg: #f7f3ec;
  --tab-active-border: #ece5d8;
  --tab-active-color: #7f6b5b;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.gs-tab--theme-dark {
  --tab-bg: #2a3444;
  --tab-arrow-bg: #6b7a92;
  --tab-border-color: #6b7a92;
  --tab-text-color: #a9b4c4;
  --tab-hover-color: #d3bc8e;
  --tab-active-bg: #3e4556;
  --tab-active-border: #d3bc8e;
  --tab-active-color: #f7d98a;
}

.gs-tab--size-small {
  --tab-font-size: 16px;
  --tab-item-min-width: 120px;
  --tab-item-padding: 3px 16px;
}

.gs-tab--size-large {
  --tab-font-size: 24px;
  --tab-item-min-width: 180px;
  --tab-item-padding: 8px 30px;
}

@mixin clip-shape() {
  clip-path: path(
    'M 7.5 10 \
    A 20 20 0 0 0 20 0 \
    A 23 23 0 0 0 20 20 \
    A 20 20 0 0 0 7.5 10 \
    L 12.8377 10 \
    A 22 22 0 0 0 15.787 11.931 \
    A 25 25 0 0 0 15.787 8.069 \
    A 22 22 0 0 0 12.8377 10 \
    Z'
  );
}

.gs-tab-title {
  --arrow-size: 20px;
  font-size: var(--tab-font-size);
  background: var(--tab-bg);
  border: 1px solid var(--tab-border-color);
  border-radius: 999px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2px;
  gap: 2px;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    left: calc(0px - var(--arrow-size));
    top: calc(50% - (var(--arrow-size) / 2));
    background: var(--tab-arrow-bg);
    width: var(--arrow-size);
    height: var(--arrow-size);
    scale: 1.4;
    translate: -20% 0;
    @include clip-shape();
  }
  &::after {
    content: '';
    position: absolute;
    left: calc(100%);
    top: calc(50% - (var(--arrow-size) / 2));
    background: var(--tab-arrow-bg);
    width: var(--arrow-size);
    height: var(--arrow-size);
    scale: 1.4;
    translate: 20% 0;
    rotate: 180deg;
    @include clip-shape();
  }
}

.gs-tab-title__item {
  --border-color: transparent;
  --border-width: 2px;
  cursor: pointer;
  text-align: center;
  min-width: var(--tab-item-min-width);
  color: var(--tab-text-color);
  border-radius: 999px;
  padding: var(--tab-item-padding);
  position: relative;
  transition: all 200ms ease;
  user-select: none;
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    border: var(--border-width) solid var(--border-color);
    width: calc(100% - calc(2 * var(--border-width)));
    height: calc(100% - calc(2 * var(--border-width)));
    transform: translate(var(--border-width), var(--border-width));
    border-radius: 999px;
  }
  &:hover {
    color: var(--tab-hover-color);
  }
  &:active {
    background: var(--tab-active-bg);
    color: var(--tab-active-color);
    --border-color: var(--tab-active-border);
  }
  &.actived {
    background: var(--tab-active-bg);
    color: var(--tab-active-color);
    --border-color: var(--tab-active-border);
  }
}

.gs-tab-content {
  width: 100%;
  flex: 1;
}
</style>
