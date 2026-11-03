<script lang="ts" setup>
import { Select, SemiSelect } from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue?: boolean
}>()
const emits = defineEmits<{
  'update:modelValue': [v: boolean]
}>()

const disabled = ref(false)
const onTransitionStart = (ev: TransitionEvent) => {
  if (ev.propertyName === 'background-color') disabled.value = true
}
const onTransitionEnd = (ev: TransitionEvent) => {
  if (ev.propertyName === 'background-color') disabled.value = false
}

const toggleValue = () => {
  if (disabled.value) return
  emits('update:modelValue', !props.modelValue)
}
</script>

<template>
  <div
    class="gs-marker-switch"
    :class="{ actived: modelValue }"
    @click="toggleValue"
    @transitionstart="onTransitionStart"
    @transitionend="onTransitionEnd"
  >
    <div class="gs-marker-switch--slider p-1">
      <div
        class="h-full aspect-square rounded-full border-2 p-0.5"
        :class="{
          'border-green-700': modelValue,
          'border-slate-700': !modelValue,
        }"
      >
        <component
          :is="modelValue ? Select : SemiSelect"
          :class="{
            'text-green-700': modelValue,
            'text-slate-700': !modelValue,
          }"
        />
      </div>
      <div class="flex-1 text-center text-sm">
        {{ modelValue ? '已完成' : '未完成' }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.gs-marker-switch {
  --switch-height: 32px;
  --switch-bg: #353d4f;
  --switch-border-color: #ebe4d8;

  --switch-slider-border-color: #a69678;
  --switch-slider-bg: #fff8de;
  --switch-slider-color: #353d4f;
  --switch-slider-translate: 0% 0%;
  --switch-slider-filter: none;

  width: 120px;
  height: var(--switch-height);
  padding: 2px;
  background-color: var(--switch-bg);
  border-radius: calc(var(--switch-height) / 2);
  border: 2px solid var(--switch-border-color);
  outline-offset: -2px;
  transition: all ease 150ms;
  user-select: none;
  cursor: pointer;
  filter: drop-shadow(0 0 2px #66666660);

  &:hover {
    --switch-slider-filter: brightness(95%);
    filter: drop-shadow(0 0 2px #666666);
  }

  &:active {
    --switch-slider-filter: brightness(90%);
    filter: drop-shadow(0 0 2px #66666660);
  }

  &.actived {
    --switch-bg: #d3bc8e;
    --switch-slider-translate: 100% 0%;
    --switch-slider-border-color: #e0dac3;
  }
}

.gs-marker-switch--slider {
  width: 50%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid var(--switch-slider-border-color);
  border-radius: calc(var(--switch-height) / 2);
  background-color: var(--switch-slider-bg);
  color: var(--switch-slider-color);
  translate: var(--switch-slider-translate);
  transition: all ease 150ms;
  filter: var(--switch-slider-filter);
}
</style>
