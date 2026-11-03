<script setup lang="ts" generic="T">
import { Select } from '@element-plus/icons-vue'

const props = defineProps<{
  options: T[]
  getLabel: (item: T) => string
  getValue: (item: T) => string
  placeholder?: string
  getDisabled?: (option: T) => boolean
  /** 是否禁用选择选项后自动隐藏选项列表 */
  disabledAutoHidden?: boolean
}>()

const emits = defineEmits<{
  dropdownVisibleChange: [boolean]
}>()

interface NormalizedOption {
  label: string
  value: string
  disabled: boolean
  raw: T
}

const dropdownVisible = ref(false)
const listRef = ref<HTMLElement>()
const labelRef = ref<HTMLElement>()

const wrapperOptions = computed<NormalizedOption[]>(() => {
  const { options, getLabel, getValue, getDisabled } = props
  return options.map(option => ({
    label: getLabel(option),
    value: getValue(option),
    disabled: getDisabled?.(option) ?? false,
    raw: option,
  }))
})

const valueMap = computed(() => {
  return wrapperOptions.value.reduce((map, option) => {
    return map.set(option.value, option)
  }, new Map<string, NormalizedOption>())
})

const modelValue = defineModel<string>('modelValue', {
  required: false,
  default: undefined,
})

const openOptionList = () => {
  dropdownVisible.value = !dropdownVisible.value
  emits('dropdownVisibleChange', dropdownVisible.value)
}

const selectValue = (option: NormalizedOption) => {
  const { disabledAutoHidden = false } = props
  if (option.disabled) return
  modelValue.value = option.value
  if (disabledAutoHidden) return
  dropdownVisible.value = false
  emits('dropdownVisibleChange', false)
}

useEventListener('pointerdown', ev => {
  if (!dropdownVisible.value) return
  const hasTarget = ev.composedPath().find(target => {
    return target === labelRef.value || target === listRef.value
  })
  if (hasTarget) return
  dropdownVisible.value = false
  emits('dropdownVisibleChange', false)
})
</script>

<template>
  <div class="gs-select gs-select-variable">
    <div ref="labelRef" class="label-content" @click="openOptionList">
      <slot
        v-if="valueMap.has(modelValue)"
        name="label"
        :label="valueMap.get(modelValue)?.label"
        :value="`${modelValue}`"
        :option="valueMap.get(modelValue)"
        :dropdown-visible
      >
        {{ valueMap.get(modelValue)?.label ?? `${modelValue}` }}
      </slot>

      <slot v-else name="missed" :value="modelValue">
        {{ modelValue }}
      </slot>
    </div>

    <div
      ref="listRef"
      class="option-list"
      :class="{
        'is-visible': dropdownVisible,
      }"
    >
      <el-scrollbar height="100%">
        <div
          v-for="option in wrapperOptions"
          :key="option.value"
          class="option"
          :class="{
            'is-active': option.value === modelValue,
          }"
          @click="() => selectValue(option)"
        >
          <slot name="default" :label="option.label" :value="option.value" :option="option.raw">
            <div class="flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
              {{ option.label }}
            </div>
          </slot>

          <el-icon v-if="option.value === modelValue" class="absolute right-0 top-0">
            <Select />
          </el-icon>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<style scoped>
.gs-select-variable {
  --align: left;
  --height: 32px;
  --radius: calc(3px + var(--height) / 2);
}

.gs-select {
  position: relative;
  height: var(--height);
  display: flex;
  align-items: center;
}

.label-content {
  --active-opacity: 0;

  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: #c9bead;
  color: #4b5467;
  height: var(--height);
  line-height: calc(var(--height) - 8px);
  padding: 4px 10px;
  border-radius: calc(3px + var(--height) / 2);
  cursor: pointer;
  text-align: var(--align);
  position: relative;

  &::before {
    content: '';
    pointer-events: none;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(#fff8c0, transparent);
    opacity: var(--active-opacity);
    z-index: -1;
  }

  &:hover {
    outline: 2px solid white;
    filter: brightness(1.05);
  }

  &:active {
    --active-opacity: 1;
  }
}

.option-list {
  border-radius: var(--radius);
  position: absolute;
  padding: 3px;
  z-index: 10;
  top: 100%;
  left: 0;
  width: 100%;
  height: 240px;
  background: #495366;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity ease 150ms;

  &.is-visible {
    opacity: 1;
    pointer-events: auto;
  }
}

.option {
  --bg: transparent;
  --sc: 0.98 0.95;
  --color: #ece5d8;

  position: relative;
  padding: 4px 10px;
  height: var(--height);
  border-radius: var(--radius);
  color: var(--color);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  text-align: var(--align);

  &::before {
    border-radius: var(--radius);
    pointer-events: none;
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg);
    scale: var(--sc);
    transition: all ease-out 100ms;
    z-index: -1;
  }

  &.is-active {
    --bg: #ece5d830;
  }

  &:hover {
    --sc: 1 1;
    --bg: #ece5d830;
  }

  &:active {
    --color: #495366;
    --bg: #ece5d8;
  }
}
</style>
