<script lang="ts" setup>
import { GSButton, GSDivider } from '@/components'
import { useMapStateStore } from '@/stores'
import { SelectList } from '../SelectList'
import { FilterIcon } from './FilterIcon'

const emits = defineEmits<{
  select: [v: number]
}>()

const modelValue = defineModel<boolean>('modelValue', {
  required: true,
  default: false,
})

const { markerAdvancedFilterConfigs } = useMapStateStore()

const selectedId = ref(0)

const handleSelect = () => {
  if (!selectedId.value || selectedId.value <= 0) return

  emits('select', selectedId.value)
  selectedId.value = 0
  modelValue.value = false
}

const handleClose = () => {
  selectedId.value = 0
  modelValue.value = false
}
</script>

<template>
  <el-dialog
    v-model="modelValue"
    :show-close="false"
    :close-on-click-modal="false"
    append-to-body
    align-center
    width="fit-content"
    class="custom-dialog hidden-header bg-transparent"
    @closed="handleClose"
  >
    <div
      class="genshin-dark-card flex flex-col overflow-hidden font-['HYWenHei-85W'] min-w-[600px] h-[600px] max-w-[100dvw] max-h-[100dvh]"
    >
      <div class="text-xl text-center">选择筛选类型</div>
      <GSDivider color="#76716A" :height="34" />
      <el-scrollbar class="flex-1">
        <SelectList
          v-model="selectedId"
          class="h-full overflow-auto gap-1 grid grid-cols-3"
          :list="markerAdvancedFilterConfigs"
          value-key="id"
        >
          <template #icon="{ item }">
            <FilterIcon :id="item.id" class="w-[1.3rem] h-[1.3rem] self-center mr-2" />
          </template>
          <template #default="{ item }">
            {{ item.name }}
          </template>
        </SelectList>
      </el-scrollbar>

      <GSDivider color="#76716A" :height="34" />

      <div class="flex gap-4">
        <GSButton class="flex-1" icon="cancel" @click="handleClose"> 取消 </GSButton>
        <GSButton
          :disabled="!selectedId && selectedId <= 0"
          class="flex-1"
          icon="submit"
          @click="handleSelect"
        >
          使用
        </GSButton>
      </div>
    </div>
  </el-dialog>
</template>
