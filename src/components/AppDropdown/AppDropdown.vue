<script setup lang="ts">
import { ElDropdown } from 'element-plus'
import DropdownButton from './components/DropdownButton.vue'

const props = withDefaults(
  defineProps<{
    dropdownKey: string
    icon?: string | Component
    trigger?: 'click' | 'hover' | 'focus' | 'contextmenu'
    hideOnClick?: boolean
  }>(),
  {
    trigger: 'click',
  },
)

defineEmits<{
  // oxlint-disable-next-line typescript/no-explicit-any
  command: [any]
}>()

const modelValue = defineModel<string>('modelValue', {
  required: false,
  default: '',
})

const dropdownRef = ref<InstanceType<typeof ElDropdown>>()

const internalVisible = ref(false)

const handleVisibleChange = (visible: boolean) => {
  internalVisible.value = visible
  if (!visible) {
    modelValue.value = ''
    return
  }
  modelValue.value = props.dropdownKey
}

watch(modelValue, key => {
  if (!internalVisible.value || !modelValue.value) return
  if (props.dropdownKey !== key) dropdownRef.value?.handleClose()
})

defineExpose({
  close: () => dropdownRef.value?.handleClose(),
})
</script>

<template>
  <ElDropdown
    ref="dropdownRef"
    :trigger
    :hide-on-click="hideOnClick"
    @visible-change="v => handleVisibleChange(v)"
    @command="command => $emit('command', command)"
  >
    <template #default>
      <DropdownButton :is-open="dropdownKey === modelValue" :icon="icon">
        <slot name="default" />
      </DropdownButton>
    </template>

    <template #dropdown>
      <slot name="dropdown" />
    </template>
  </ElDropdown>
</template>
