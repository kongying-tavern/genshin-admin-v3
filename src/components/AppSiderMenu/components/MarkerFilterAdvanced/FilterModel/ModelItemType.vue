<script lang="ts" setup>
import type { ItemTypeVo } from '@/api/alova/globals'
import type { MAFMetaItemType, MAFOptionSelect, MAFValueNumberArray } from '@/stores/types'
import { IconApplication } from '@/components/AppIcons'
import { MarkerFilterButton } from '../../MarkerFilterComponent'
import { SelectBase } from '../FilterModelComponent'

defineProps<{
  options: MAFOptionSelect<ItemTypeVo>
  meta: MAFMetaItemType
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
    <span class="flex-none">类别</span>
    <SelectBase v-model="modelValue.na" :options="options">
      <MarkerFilterButton theme="dark">
        <template #icon>
          <IconApplication />
        </template>
        <template v-if="meta.tag" #default>
          {{ meta.tag }}
        </template>
      </MarkerFilterButton>
    </SelectBase>
  </div>
</template>
