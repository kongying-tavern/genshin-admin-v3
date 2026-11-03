<script lang="ts" setup>
import type { ItemQueryForm } from '../hooks'
import { CirclePlus, Menu, RefreshRight } from '@element-plus/icons-vue'
import { AppDropdown } from '@/components'
import { IconListView } from '@/components/AppIcons'
import { SPECIALFLAG_OPTIONS } from '@/shared'
import { useAreaStore, useItemTypeStore } from '@/stores'
import { ExplorerType } from '../shared'

defineProps<{
  loading: boolean
}>()

defineEmits<{
  create: []
  change: []
  refresh: []
}>()

const modelValue = defineModel<ItemQueryForm>('modelValue', {
  required: true,
})

const explorerType = defineModel<ExplorerType>('explorerType', {
  required: true,
})

const explorerTypes = shallowRef([
  { label: '网格', value: ExplorerType.Grid, icon: Menu },
  { label: '列表', value: ExplorerType.List, icon: IconListView },
])

const handleExplorerTypeChange = (type: ExplorerType) => {
  explorerType.value = type
}

const areaStore = useAreaStore()
const itemTypeStore = useItemTypeStore()

const areaList = computed(() => {
  return areaStore.areaList
    .filter(({ isFinal }) => isFinal)
    .toSorted(({ sortIndex: ia = 0 }, { sortIndex: ib = 0 }) => ib - ia)
})

const typeList = computed(() => {
  return itemTypeStore.itemTypeList
    .filter(({ isFinal }) => isFinal)
    .toSorted(({ sortIndex: ia = 0 }, { sortIndex: ib = 0 }) => ib - ia)
})

const dropdownKey = ref('')
</script>

<template>
  <el-form
    class="w-full p-2 border-b-[1px] border-[var(--el-border-color-lighter)]"
    :disabled="loading"
    @submit.prevent=""
  >
    <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-y-1 gap-x-8">
      <el-form-item label="物品名称" style="margin-bottom: 0">
        <el-input
          v-model="modelValue.name"
          clearable
          placeholder="请输入物品名称"
          style="width: 100%"
          @change="() => $emit('change')"
        />
      </el-form-item>

      <el-form-item label="所属地区" style="margin-bottom: 0">
        <el-select-v2
          v-model="modelValue.areaId"
          :options="areaList"
          :props="{ label: 'name', value: 'id' }"
          clearable
          filterable
          @change="() => $emit('change')"
        />
      </el-form-item>

      <el-form-item label="物品类型" style="margin-bottom: 0">
        <el-select-v2
          v-model="modelValue.itemTypeId"
          :options="typeList"
          :props="{ label: 'name', value: 'id' }"
          clearable
          filterable
          @change="() => $emit('change')"
        />
      </el-form-item>

      <el-form-item label="物品属性" style="margin-bottom: 0">
        <el-select-v2
          v-model="modelValue.specialFlag"
          :options="SPECIALFLAG_OPTIONS"
          :props="{ label: 'label', value: 'mask' }"
          clearable
          filterable
          @change="() => $emit('change')"
        />
      </el-form-item>

      <el-form-item label-width="0px" style="margin-bottom: 0">
        <div class="w-full flex items-center justify-end">
          <el-button :loading="loading" :icon="RefreshRight" text @click="() => $emit('refresh')">
            刷新
          </el-button>

          <AppDropdown
            v-model="dropdownKey"
            dropdown-key="filter"
            :icon="explorerType === ExplorerType.List ? IconListView : Menu"
            @command="handleExplorerTypeChange"
          >
            <template #default> 查看 </template>

            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="option in explorerTypes"
                  :key="option.value"
                  :command="option.value"
                >
                  <div class="flex items-center gap-2">
                    <el-icon
                      class="transition-all"
                      :style="{
                        'content-visibility': option.value === explorerType ? 'auto' : 'hidden',
                      }"
                      :size="12"
                    >
                      <CircleCheck />
                    </el-icon>
                    <el-icon>
                      <component :is="option.icon" />
                    </el-icon>
                    <div>{{ option.label }}</div>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </AppDropdown>

          <el-divider direction="vertical" />

          <el-button text :icon="CirclePlus" @click="() => $emit('create')"> 新增 </el-button>
        </div>
      </el-form-item>
    </div>
  </el-form>
</template>

<style scoped>
.flow-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
</style>
