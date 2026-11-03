<script lang="ts" setup>
import type { CascaderProps } from 'element-plus'
import type { AreaVo } from '@/api/alova/globals'
import { useAreaStore } from '@/stores'
import { array2Tree } from '@/utils'

const props = withDefaults(
  defineProps<{
    /** 子地区 code，必须为 `A:${string}:${string}` 格式 */
    modelValue?: string
    isAreaDisabled?: (area: AreaVo) => boolean
  }>(),
  {
    modelValue: undefined,
  },
)

const emits = defineEmits<{
  'update:modelValue': [code: string]
}>()

const areaStore = useAreaStore()

const internalAreaCode = ref<string>('')

const covertCodeToCodes = (childCode: string) => {
  const name = childCode.split(':')[1]
  return [`C:${name}`, childCode]
}

const areaCodeList = computed({
  get: () => {
    if (props.modelValue === undefined) return covertCodeToCodes(internalAreaCode.value)
    if (!props.modelValue) return []
    return covertCodeToCodes(props.modelValue)
  },
  set: ([_, childAreaCode]) => {
    if (props.modelValue === undefined) {
      internalAreaCode.value = childAreaCode
      return
    }
    emits('update:modelValue', childAreaCode)
  },
})

const areaOptions = computed(() => {
  const { isAreaDisabled } = props
  return array2Tree(
    areaStore.areaList.map(area => ({
      _raw: area,
      label: area.name,
      value: area.code,
      disabled: isAreaDisabled ? isAreaDisabled(area) : false,
      id: area.id,
      pid: area.parentId,
      isFinal: area.isFinal,
    })),
    {
      childrenKey: 'children',
      getId: area => area.id!,
      getPid: area => area.pid!,
      rootId: -1,
    },
  )
})

const areaCascaderProps: CascaderProps = {
  leaf: 'isFinal',
  multiple: false,
}
</script>

<template>
  <el-cascader
    v-bind="$attrs"
    v-model="areaCodeList"
    :options="areaOptions"
    :props="areaCascaderProps"
    placeholder="选择地区"
  />
</template>
