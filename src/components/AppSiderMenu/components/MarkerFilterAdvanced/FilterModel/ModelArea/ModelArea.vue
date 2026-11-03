<script lang="ts" setup>
import type { AreaWithChildren } from '@/stores'
import type { MAFMetaArea, MAFOptionSelect, MAFValueNumberArray } from '@/stores/types'
import { Place } from '@element-plus/icons-vue'
import { MarkerFilterButton, MarkerFilterSelectPanel } from '../../../MarkerFilterComponent'
import ModelAreaDialog from './ModelAreaDialog.vue'

defineProps<{
  options: MAFOptionSelect<AreaWithChildren>
  meta: MAFMetaArea
}>()

const modelValue = defineModel<MAFValueNumberArray>('modelValue', {
  required: false,
  default: {
    na: [],
  },
})
</script>

<template>
  <div class="flex-auto flex gap-1 items-center">
    <span class="flex-none">地区</span>
    <MarkerFilterSelectPanel
      v-model="modelValue.na"
      :multiple="options.optionSelectMultiple"
      :list="options.options"
      :label-key="options.optionLabel"
      :value-key="options.optionValue"
      :dialog-title="options.dialogTitle"
      :dialog-list-class="options.dialogListClass"
    >
      <template #default>
        <MarkerFilterButton theme="dark">
          <template #icon>
            <Place />
          </template>
          <template v-if="meta.tag" #default>
            {{ meta.tag }}
          </template>
        </MarkerFilterButton>
      </template>

      <template #list="listProps">
        <ModelAreaDialog v-bind="listProps" :meta="meta" />
      </template>
    </MarkerFilterSelectPanel>
  </div>
</template>
