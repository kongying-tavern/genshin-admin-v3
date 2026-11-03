<script lang="ts" setup>
import type { MAFItemComposed, MAFValue } from '@/stores/types'
import { MAFModelId } from '@/shared'
import {
  ModelArea,
  ModelContentContain,
  ModelContentRegex,
  ModelIdRange,
  ModelImage,
  ModelItemCount,
  ModelItemName,
  ModelItemNameRegex,
  ModelItemSize,
  ModelItemType,
  ModelLinkage,
  ModelLinkageAction,
  ModelRefreshTime,
  ModelTitleContain,
  ModelUnderground,
  ModelUndergroundLayer,
  ModelVideo,
  ModelVisibility,
} from '.'

const props = defineProps<{
  composedCondition: MAFItemComposed
}>()

const modelValue = defineModel<MAFValue>('modelValue', {
  required: false,
  default: {},
})

const modelTemplate = computed(() => {
  return {
    [MAFModelId.ID_RANGE]: ModelIdRange,
    [MAFModelId.TITLE_CONTAIN]: ModelTitleContain,
    [MAFModelId.CONTENT_CONTAIN]: ModelContentContain,
    [MAFModelId.CONTENT_REGEX]: ModelContentRegex,
    [MAFModelId.IMAGE]: ModelImage,
    [MAFModelId.VIDEO]: ModelVideo,
    [MAFModelId.REFRESH_TIME]: ModelRefreshTime,
    [MAFModelId.VISIBILITY]: ModelVisibility,
    [MAFModelId.AREA]: ModelArea,
    [MAFModelId.ITEM_TYPE]: ModelItemType,
    [MAFModelId.ITEM_NAME]: ModelItemName,
    [MAFModelId.ITEM_NAME_REGEX]: ModelItemNameRegex,
    [MAFModelId.ITEM_SIZE]: ModelItemSize,
    [MAFModelId.ITEM_COUNT]: ModelItemCount,
    [MAFModelId.UNDERGROUND]: ModelUnderground,
    [MAFModelId.UNDERGROUND_LAYER]: ModelUndergroundLayer,
    [MAFModelId.LINKAGE]: ModelLinkage,
    [MAFModelId.LINKAGE_ACTION]: ModelLinkageAction,
  }[props.composedCondition.id]
})

const modelOptions = computed(() => toValue(props.composedCondition.option))
</script>

<template>
  <component
    :is="modelTemplate"
    v-if="modelTemplate"
    v-model="modelValue as any"
    :options="modelOptions"
    :meta="composedCondition.meta"
  />
</template>
