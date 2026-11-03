<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { GSButton, GSDivider } from '@/components'
import { usePreferenceStore, useTileStore } from '@/stores'
import { SelectList } from '../SelectList'

const emits = defineEmits<{
  select: [v?: string]
}>()

const modelValue = defineModel<boolean>('modelValue', {
  required: true,
  default: false,
})

const preferenceStore = usePreferenceStore()

const { currentTileCode, mapTileOptions } = storeToRefs(useTileStore())

const selectedValue = ref<string>('')

const open = () => {
  const currentTileOption = mapTileOptions.value.find(v => v.tile.code === currentTileCode.value)
  selectedValue.value = currentTileOption?.code ?? ''
}

const confirm = () => {
  preferenceStore.areaCode = selectedValue.value
  emits('select', selectedValue.value)
  selectedValue.value = ''
  modelValue.value = false
}

const cancel = () => {
  selectedValue.value = ''
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
    class="custom-dialog hidden-header bg-transparent min-w-[500px]"
    @open="open()"
  >
    <div class="genshin-dark-card flex flex-col overflow-hidden font-['HYWenHei-85W']">
      <div class="text-xl text-center">选择地图</div>
      <GSDivider color="#76716A" :height="34" />

      <el-scrollbar class="flex-1">
        <SelectList
          v-model="selectedValue"
          :list="mapTileOptions"
          class="grid grid-cols-2"
          value-key="code"
        >
          <template #default="{ item }">
            {{ item.tile.name }}
          </template>
        </SelectList>
      </el-scrollbar>

      <GSDivider color="#76716A" :height="34" />

      <div class="flex gap-4">
        <GSButton class="flex-1" icon="cancel" @click="cancel()"> 取消 </GSButton>
        <GSButton class="flex-1" :disabled="!selectedValue" icon="submit" @click="confirm()">
          切换
        </GSButton>
      </div>
    </div>
  </el-dialog>
</template>
