<script lang="ts" setup>
import type { LINK_ACTION_OPTIONS } from '@/shared/linkAction'
import type { MAFMetaVisibility, MAFOptionSelect, MAFValueStringArray } from '@/stores/types'
import { IconLink } from '@/components/AppIcons'
import { MarkerFilterButton } from '../../MarkerFilterComponent'
import { SelectBase } from '../FilterModelComponent'

defineProps<{
  options: MAFOptionSelect<(typeof LINK_ACTION_OPTIONS)[0]>
  meta: MAFMetaVisibility
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
    <span class="flex-none">点位关联包含</span>
    <SelectBase v-model="modelValue.sa" :options="options">
      <MarkerFilterButton theme="dark">
        <template #icon>
          <IconLink />
        </template>
        <template v-if="meta.tag" #default>
          {{ meta.tag }}
        </template>
      </MarkerFilterButton>
    </SelectBase>
  </div>
</template>
