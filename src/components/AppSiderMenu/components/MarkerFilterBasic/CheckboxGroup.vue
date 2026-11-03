<script
  setup
  lang="ts"
  generic="
    T extends Record<string, any>,
    LK extends keyof T,
    VK extends keyof T,
    V extends T[VK],
    VV extends V[]
  "
>
import { Finished } from '@element-plus/icons-vue'
import { CheckboxItem } from '.'

const props = defineProps<{
  options: T[]
  /** 实际标签的 key 名 */
  labelKey: LK
  /** 实际值的 key 名 */
  valueKey: VK
  /** 多选 */
  multiple?: boolean
  /** 两列 */
  twoCol?: boolean
  /** 是否显示全选按钮，仅在 multiple 模式下生效 */
  showSelectAllBtn?: boolean
  /** 拖拽控制 key */
  draggable?: boolean
}>()

const emits = defineEmits<{
  (e: 'change', v?: V | VV): void
}>()

/** 单选值 */
const modelValue = defineModel<V>('modelValue', {
  required: false,
  default: undefined,
})

/** 多选值 */
const modelMultipleValue = defineModel<VV>('multipleValue', {
  required: false,
  default: [],
})

const isActived = (targetOpt: T) => {
  return !props.multiple
    ? modelValue.value === targetOpt[props.valueKey]
    : modelMultipleValue.value.findIndex(value => value === targetOpt[props.valueKey]) > -1
}

const patchValue = (patchOpt: T) => {
  // 单选
  if (!props.multiple) {
    modelValue.value = patchOpt[props.valueKey]
    emits('change', patchOpt[props.valueKey] as V)
  }
  // 多选
  else {
    const shallowCopyValue = [...modelMultipleValue.value]
    const findIndex = shallowCopyValue.findIndex(value => value === patchOpt[props.valueKey])
    if (findIndex > -1) shallowCopyValue.splice(findIndex, 1)
    else shallowCopyValue.push(patchOpt[props.valueKey])
    modelMultipleValue.value = shallowCopyValue as VV
    emits('change', shallowCopyValue as VV)
  }
}

const isAllSelected = computed(() => {
  const set = new Set(modelMultipleValue.value)
  for (const item of props.options) {
    if (!set.has(item[props.valueKey])) return false
  }
  return true
})

const toggleAllSelect = () => {
  if (!props.multiple) return
  const toggledValue = (() => {
    const existValues = new Set(modelMultipleValue.value)
    isAllSelected.value
      ? props.options.forEach(item => existValues.delete(item[props.valueKey]))
      : props.options.forEach(item => {
          const value = item[props.valueKey]
          !existValues.has(value) && existValues.add(value)
        })
    return [...existValues]
  })()

  modelMultipleValue.value = toggledValue as VV
  emits('change', toggledValue as VV)
}

// ==================== 拖拽控制 ====================
const handleDragStart = (ev: DragEvent, row: T) => {
  if (!props.draggable || !ev.dataTransfer) return
  ev.dataTransfer.setData('text', JSON.stringify(row))
}
</script>

<template>
  <div class="checkbox-group font-[HYWenHei-85W]">
    <el-scrollbar
      class="checkbox-group-scrollbar"
      always
      :view-class="`grid gap-1 p-2 ${twoCol ? 'grid-cols-2' : 'grid-cols-1'}`"
    >
      <CheckboxItem
        v-if="multiple && showSelectAllBtn && options.length"
        label="选择全部"
        :is-actived="isAllSelected"
        @click="toggleAllSelect"
      >
        <template #icon>
          <slot name="all-select-icon">
            <Finished />
          </slot>
        </template>

        <template v-if="$slots.all" #default>
          <slot name="all" :actived="isAllSelected" />
        </template>
      </CheckboxItem>

      <CheckboxItem
        v-for="opt in options"
        :key="`${opt[valueKey as keyof T]}`"
        :label="opt[labelKey as keyof T]"
        :is-actived="isActived(opt)"
        :draggable="draggable"
        @dragstart="(ev: DragEvent) => handleDragStart(ev, opt)"
        @click="() => patchValue(opt)"
      >
        <template v-if="$slots.icon" #icon>
          <slot name="icon" :row="opt" :actived="isActived(opt)" />
        </template>

        <template v-if="$slots.default" #default>
          <slot name="default" :row="opt" :actived="isActived(opt)" />
        </template>
      </CheckboxItem>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.checkbox-group {
  overflow: auto;
  height: 100%;
}

.checkbox-group-scrollbar {
  --el-scrollbar-opacity: 1;
  :deep(.el-scrollbar__thumb) {
    background-color: #d3bc8e;
  }
}
</style>
