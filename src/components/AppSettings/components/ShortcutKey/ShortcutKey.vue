<script setup lang="ts">
import { EditPen } from '@element-plus/icons-vue'
import { ElDialog } from 'element-plus'
import { KEYBOARD_ALIAS } from '@/shared'
import { ShortcutKeyUtil } from '@/utils'
import ShortcutConfiger from './ShortcutConfiger.vue'

const props = withDefaults(
  defineProps<{
    defaultValue?: string
    /**
     * 只有传入了聚焦判断元素属性，此功能才可以设置不需要触发按键的快捷键组合
     * @警告 未约束快捷键实现时是否处于 focus，需要自行处理
     */
    focusElement?: HTMLElement
  }>(),
  {
    defaultValue: undefined,
    focusElement: undefined,
  },
)

const modelValue = defineModel<string>('modelValue', {
  required: false,
  default: '',
})

const keys = computed(() => ShortcutKeyUtil.parse(modelValue.value))

const configVisible = ref(false)

const showConfiger = () => {
  configVisible.value = true
}
</script>

<template>
  <div
    class="shortcut-key"
    :class="!keys.length ? 'text-[var(--el-text-color-secondary)]' : ''"
    @click="showConfiger"
  >
    <div v-if="!keys.length" class="text-xs px-2">未设置快捷键</div>

    <div v-for="key in keys" :key="key" class="key-item">
      {{ KEYBOARD_ALIAS.get(key) }}
    </div>

    <el-icon class="ml-1">
      <EditPen />
    </el-icon>

    <ElDialog
      v-model="configVisible"
      destroy-on-close
      append-to-body
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      class="custom-dialog hidden-header"
      :style="{
        '--el-dialog-border-radius': '8px',
        '--el-dialog-padding-primary': '0',
        '--el-dialog-width': 'auto',
      }"
    >
      <ShortcutConfiger
        v-model:visible="configVisible"
        v-model="modelValue"
        :default-value="props.defaultValue"
        :focus-element="props.focusElement"
      />
    </ElDialog>
  </div>
</template>

<style scoped>
.shortcut-key {
  --key-bg: transparent;

  height: 34px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    z-index: 1;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    background-color: var(--key-bg);
    opacity: 0.1;
    border-radius: 6px;
  }

  &:hover {
    border-color: var(--el-border-color-dark);
  }

  &:active {
    border-color: var(--el-border-color-darker);
    --key-bg: var(--el-color-primary-light-3);
  }
}

.key-item {
  @apply font-mono;
  font-size: 14px;
  min-width: 24px;
  line-height: 24px;
  text-align: center;
  background: var(--el-fill-color-darker);
  white-space: nowrap;
  padding: 0 4px;
  border-radius: 2px;
  user-select: none;
}
</style>
