<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'

const props = defineProps<{
  isActive?: boolean
  plain?: boolean
  name?: string
  disabled?: boolean
  click?: MouseEvent
}>()

const emits = defineEmits<{
  click: [ev: MouseEvent]
}>()

const dropdownVisible = ref(false)

const toggleDropdown = () => {
  dropdownVisible.value = !dropdownVisible.value
}

const closeDropdown = () => {
  dropdownVisible.value = false
}

const dropdownArrowRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()

useEventListener('click', ev => {
  if (!dropdownVisible.value) return
  const path = ev.composedPath()
  for (const key in path) {
    const ele = path[key]
    if (ele === dropdownArrowRef.value || ele === dropdownRef.value) return
  }
  closeDropdown()
})

const handleClick = (ev: MouseEvent) => {
  if (props.disabled) return
  emits('click', ev)
}
</script>

<template>
  <div
    class="tool-item"
    :class="{
      'has-dropdown': Boolean($slots.dropdown),
      'is-active': isActive,
      'dropdown-open': dropdownVisible,
      plain,
    }"
  >
    <div class="item-content" @click="handleClick">
      <div class="flex-1 w-full grid place-items-center">
        <slot name="default" />
      </div>
      <div v-if="name" class="item-name">
        {{ name }}
      </div>
    </div>

    <div
      v-if="$slots.dropdown"
      ref="dropdownArrowRef"
      class="item-dropdown-icon"
      @click="toggleDropdown"
    >
      <el-icon
        class="scale-90 transition-all"
        :size="12"
        :class="dropdownVisible ? 'rotate-180' : ''"
        color="var(--el-text-color-regular)"
      >
        <ArrowDown />
      </el-icon>
    </div>

    <div
      ref="dropdownRef"
      class="item-dropdown-content"
      :class="{
        'is-hidden': !dropdownVisible,
      }"
    >
      <slot name="dropdown" :close="closeDropdown" />
    </div>
  </div>
</template>

<style scoped>
.tool-item {
  --cursor: auto;
  --item-bg: transparent;
  --item-bg--hover: transparent;
  --item-bg--active: transparent;
  --radius: 4px;
  --state-color: unset;
  --content-radius: var(--radius) var(--radius) var(--radius) var(--radius);

  height: 32px;
  display: flex;
  transition: all ease 150ms;
  color: var(--el-color-info);
  user-select: none;
  line-height: 1;
  position: relative;
  overflow: visible;

  &.is-active {
    color: var(--el-color-primary);
    --state-color: var(--el-color-primary);
  }

  &.dropdown-open {
    --item-bg: var(--el-fill-color-darker);
  }

  &.has-dropdown {
    --content-radius: 4px 0 0 4px;
  }

  &:not(.plain) {
    --cursor: pointer;
    --item-bg--hover: var(--el-fill-color-dark);
    --item-bg--active: var(--el-fill-color-darker);
  }
}

.item-content {
  cursor: var(--cursor);
  min-width: 32px;
  display: flex;
  flex-direction: column;
  border-radius: var(--content-radius);

  &:hover {
    background: var(--item-bg--hover);
    color: var(--state-color, var(--el-text-color-regular));
  }
  &:active {
    background: var(--item-bg--active);
  }
}

.item-name {
  font-size: 12px;
  scale: 0.8;
  width: 100%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-dropdown-icon {
  cursor: pointer;
  width: 14px;
  overflow: visible;
  display: grid;
  place-items: center;
  border-radius: 0 var(--radius) var(--radius) 0;
  background: var(--item-bg);

  &:hover {
    background: var(--item-bg--hover);
  }
  &:active {
    background: var(--item-bg--active);
  }
}

.item-dropdown-content {
  position: absolute;
  left: 0;
  top: 100%;
  z-index: 1;
  background: #fff;

  &.is-hidden {
    content-visibility: hidden;
    @supports not (content-visibility: hidden) {
      display: none;
    }
  }
}
</style>
