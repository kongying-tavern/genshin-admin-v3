<script lang="ts" setup>
import type { MarkerSearchParams } from '../hooks'
import { useAreaStore } from '@/stores'
import { useItemList, useItemType } from '../hooks'

const emits = defineEmits<{
  change: []
}>()

const modelValue = defineModel<MarkerSearchParams>('modelValue', {
  required: true,
})

const markerIds = ref(modelValue.value.markerIdList.join(','))

const changeMarkerIds = (value: string) => {
  const ids = new Set<number>()
  value.split(',').forEach(char => {
    if (!char) return
    const num = Number(char)
    if (Number.isInteger(num)) ids.add(num)
  })
  modelValue.value.markerIdList = [...ids]
  emits('change')
}

// ==================== 地区 ====================
const areaStore = useAreaStore()
const areaList = computed(() =>
  areaStore.areaList
    .filter(area => area.isFinal)
    .toSorted(({ sortIndex: ia = 0 }, { sortIndex: ib = 0 }) => ib - ia),
)

// ==================== 类型 ====================
const { typeOptions: itemTypeOptions } = useItemType()

// ==================== 物品 ====================
const { itemOptions } = useItemList({
  params: () => ({
    areaIdList: modelValue.value.areaIdList,
    typeIdList: modelValue.value.typeIdList,
  }),
})

// 当已选物品不存在于物品选项中时，重置已选物品
watch(itemOptions, options => {
  for (const itemId of modelValue.value.itemIdList) {
    if (!options.find(opt => opt.value === itemId)) {
      modelValue.value.itemIdList = []
      return
    }
  }
})
</script>

<template>
  <el-form
    class="w-full p-2 border-b-[1px] border-[var(--el-border-color-lighter)]"
    label-width="70px"
  >
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6">
      <el-form-item label="点位ID" style="margin-bottom: 0">
        <el-input
          v-model="markerIds"
          placeholder="可使用逗号分隔查询多个"
          style="width: 100%"
          clearable
          @change="changeMarkerIds"
        />
      </el-form-item>

      <el-form-item label="所属地区" style="margin-bottom: 0">
        <el-select-v2
          v-model="modelValue.areaIdList"
          placeholder="请选择地区"
          clearable
          multiple
          collapse-tags
          collapse-tags-tooltip
          filterable
          style="width: 100%"
          :options="areaList"
          :props="{ label: 'name', value: 'id' }"
          @change="() => $emit('change')"
        />
      </el-form-item>

      <el-form-item label="类型" style="margin-bottom: 0">
        <el-select-v2
          v-model="modelValue.typeIdList"
          placeholder="请选择点位类型"
          node-key="id"
          collapse-tags
          collapse-tags-tooltip
          clearable
          filterable
          multiple
          style="width: 100%"
          :options="itemTypeOptions"
          @change="() => $emit('change')"
        />
      </el-form-item>

      <el-form-item label="物品" style="margin-bottom: 0">
        <el-select-v2
          v-model="modelValue.itemIdList"
          placeholder="请选择物品"
          node-key="id"
          collapse-tags
          collapse-tags-tooltip
          clearable
          filterable
          multiple
          style="width: 100%"
          :options="itemOptions"
          @change="() => $emit('change')"
        />
      </el-form-item>
    </div>
  </el-form>
</template>
