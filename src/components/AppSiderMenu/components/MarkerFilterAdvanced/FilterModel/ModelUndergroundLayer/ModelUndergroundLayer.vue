<script lang="ts" setup>
import type { AreaWithExtraConfig } from '@/stores'
import type { MAFMetaUndergroundLayer, MAFOptionSelect, MAFValueStringArray } from '@/stores/types'
import { IconLayersFilled } from '@/components/AppIcons'
import { MarkerFilterButton, MarkerFilterSelectPanel } from '../../../MarkerFilterComponent'
import ModelUndergroundLayerDialog from './ModelUndergroundLayerDialog.vue'

defineProps<{
  options: MAFOptionSelect<AreaWithExtraConfig>
  meta: MAFMetaUndergroundLayer
}>()

const modelValue = defineModel<MAFValueStringArray>('modelValue', {
  required: false,
  default: {
    sa: [],
  },
})
</script>

<template>
  <div class="flex-auto flex gap-1 items-center">
    <span class="flex-none">分层层级</span>
    <MarkerFilterSelectPanel
      v-model="modelValue.sa"
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
            <IconLayersFilled />
          </template>
          <template v-if="meta.tag" #default>
            {{ meta.tag }}
          </template>
        </MarkerFilterButton>
      </template>

      <template #list="listProps">
        <ModelUndergroundLayerDialog v-bind="listProps" :meta="meta" />
      </template>
    </MarkerFilterSelectPanel>
  </div>
</template>
