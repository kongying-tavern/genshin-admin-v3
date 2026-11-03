<script setup lang="ts">
const props = defineProps<{
  config: DTO.ExtraConfig
}>()

const modelValue = defineModel<DTO.MarkerExtra['underground'] | undefined>({
  required: true,
})

const isUnderground = computed({
  get: () => Boolean(toValue(modelValue)?.is_underground),
  set: bool => {
    if (!bool) {
      modelValue.value = null
      return true
    }
    modelValue.value = {
      is_underground: true,
      region_levels: [],
    }
  },
})

const isGlobal = computed({
  get: () => Boolean(toValue(modelValue)?.is_global),
  set: bool => {
    if (!modelValue.value) return false
    if (!bool) {
      Reflect.set(modelValue.value, 'is_global', null)
      Reflect.set(modelValue.value, 'region_levels', [])
      return true
    }
    Reflect.set(modelValue.value, 'is_global', true)
    Reflect.set(modelValue.value, 'region_levels', null)
  },
})

const levelConfigurable = computed(() => {
  return [
    props.config.underground?.useDetail,
    modelValue.value?.is_underground,
    !isGlobal.value,
  ].every(Boolean)
})

const placeholder = computed(() => {
  if (!isUnderground.value) return '已禁用层级配置'
  if (isGlobal.value) return '无层归属'
  return ''
})

const regionLevels = computed({
  get: () => {
    const value = toValue(modelValue)
    if (!value?.region_levels?.length) return [] as string[][]

    const { levels = [] } = props.config.underground ?? {}
    if (!levels.length) return [] as string[][]

    const regionCodeMap = levels.reduce((map, parent) => {
      parent.children.forEach(({ value }) => {
        map.set(value, parent)
      })
      return map
    }, new Map<string, (typeof levels)[number]>())

    return value.region_levels.reduce((seed, regionCode) => {
      const parent = regionCodeMap.get(regionCode)
      if (parent) seed.push([parent.value, regionCode])
      return seed
    }, [] as string[][])
  },
  set: levelList => {
    if (!modelValue.value) return false
    modelValue.value.region_levels = levelList.reduce((seed, [_, regionCode]) => {
      regionCode !== undefined && seed.push(regionCode)
      return seed
    }, [] as string[])
  },
})
</script>

<template>
  <div class="mb-4">
    <div class="mb-1 font-bold">附加层级</div>

    <div class="flex flex-col gap-2 overflow-hidden">
      <div class="flex items-center">
        <span class="mr-2"> 非地面 </span>
        <el-switch v-model="isUnderground" />

        <el-divider direction="vertical" style="height: 20px; margin: 0 16px" />

        <span class="mr-2"> 无层级 </span>
        <el-switch v-model="isGlobal" :disabled="!modelValue" />
      </div>

      <div class="flex">
        <div class="leading-[30px] mr-2 shrink-0">层归属</div>
        <el-cascader
          v-model="regionLevels"
          :disabled="!levelConfigurable"
          :options="config.underground!.levels"
          :props="{
            multiple: true,
          }"
          :show-all-levels="false"
          :placeholder="placeholder"
          class="flex-1"
        />
      </div>
    </div>
  </div>
</template>
