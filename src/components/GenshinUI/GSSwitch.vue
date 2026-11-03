<script lang="ts" setup>
import { CloseBold, Select } from '@element-plus/icons-vue'

export interface GSSwitchProps {
  modelValue?: boolean
  size?: 'small' | 'large'
  label?: string
  labelPosition?: 'left' | 'right'
  labelActiveColor?: string
  labelInactiveColor?: string
}

export interface GSSwitchEmits {
  (e: 'update:modelValue', v?: boolean): void
}

defineProps<GSSwitchProps>()
defineEmits<GSSwitchEmits>()
</script>

<template>
  <div
    class="gs-switch gs-switch-variable font-['HYWenHei-85W']"
    :class="{
      actived: modelValue,
      label,
      [`label-position-${labelPosition ?? 'right'}`]: true,
      [`size-${size ?? 'default'}`]: true,
    }"
    :style="{
      '--label-inactive-color': labelInactiveColor ?? '#CCC',
      '--label-active-color': labelActiveColor ?? '#D3BC8E',
    }"
    :data-label="label"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <div class="gs-switch__slider">
      <Transition name="pure-scale" appear>
        <component
          :is="modelValue ? Select : CloseBold"
          class="absolute"
          style="padding: calc(0.12 * var(--height))"
        />
      </Transition>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@mixin sliderBackground() {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
}

.gs-switch-variable {
  --width: 50px;
  --height: 25px;
  --border-width: 1px;
  --bg: #353d4f;
  --slider-tr-x: 0;
  --icon-color: #d3bc8e;
  --label-color: var(--label-inactive-color);
  --label-font-size: 16px;

  &.size-small {
    --width: 40px;
    --height: 20px;
  }
  &.size-large {
    --width: 60px;
    --height: 30px;
    --label-font-size: 20px;
  }
}

.gs-switch {
  width: var(--width);
  height: var(--height);
  border: var(--border-width) solid #ebe4d8;
  background: var(--bg);
  border-radius: var(--height);
  padding: calc(0.08 * var(--height));
  position: relative;
  cursor: pointer;
  user-select: none;
  color: var(--icon-color);
  transition: all ease 150ms;

  &::before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    background: var(--bg);
    transition: all ease 150ms;
    z-index: -1;
    border: calc(0.04 * var(--height)) solid rgb(100 100 100 / 0.2);
    border-radius: var(--height);
    filter: drop-shadow(0 0 2px #666);
  }

  &.label::after {
    content: attr(data-label);
    width: fit-content;
    font-size: var(--label-font-size);
    display: flex;
    align-items: center;
    position: absolute;
    height: 100%;
    top: 0;
    white-space: nowrap;
    color: var(--label-color);
  }
  &.label.label-position-right::after {
    left: calc(100% + 0.5em);
  }
  &.label.label-position-left::after {
    right: calc(100% + 0.5em);
  }

  &.actived {
    --slider-tr-x: calc(var(--width) - var(--height));
    --active-bg-scale: 1;
    --inactive-bg-scale: 0;
    --bg: #d3bc8e;
    --bg-border-color: #bfa57a;
    --icon-color: #818d9d;
    --label-color: var(--label-active-color);
  }
}

.gs-switch__slider {
  height: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 100%;
  background-color: #fff8de;
  transition: all ease 150ms;
  translate: var(--slider-tr-x) 0;
  filter: drop-shadow(0 0 1.5px #fff8de);
  position: relative;
}
</style>
