<script setup lang="ts">
import type { CascaderOption } from 'element-plus'
import type { V2_8_Island } from '@/api/alova/globals'

const props = defineProps<{
  config: DTO.ExtraConfig
}>()

const modelValue = defineModel<V2_8_Island | undefined>({
  required: true,
})

const island28Options = computed(() => {
  const { island_name } = toValue(modelValue) ?? {}
  return props.config['2_8_island']?.stages
    .filter(option => Boolean(option.value))
    .map(option => {
      const disabled = option.children && island_name && option.value !== island_name
      return { ...option, disabled }
    }) as CascaderOption[]
})

const island28BindValues = computed({
  get: () => {
    const value = toValue(modelValue) ?? {}
    const { island_name, island_state = [] } = value
    if (!island_name || !island_state.length) return []
    const parentIsland = props.config['2_8_island']?.stages.find(
      island => island.value === value.island_name,
    )
    if (!parentIsland) return []
    return island_state.map(islandValue => [parentIsland.value, islandValue])
  },
  set: islandList => {
    const parentIslandValue = islandList[0]?.[0]
    modelValue.value = {
      island_name: parentIslandValue ?? '',
      island_state: islandList
        .filter(([parentValue]) => parentValue === parentIslandValue)
        .map(([_, islandValue]) => islandValue),
    }
  },
})
</script>

<template>
  <div class="mb-4">
    <div class="mb-1">2.8 版本海岛层级</div>

    <el-cascader
      v-model="island28BindValues"
      :options="island28Options"
      :props="{
        multiple: true,
        disabled: 'disabled',
      }"
      clearable
      class="w-full"
    />
  </div>
</template>
