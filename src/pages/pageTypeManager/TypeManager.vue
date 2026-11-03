<script lang="ts" setup>
import type { TypeManagerKeys } from './definitions'
import { CirclePlus, Delete, Edit } from '@element-plus/icons-vue'
import { PgUnit, useGlobalDialog, usePagination } from '@/hooks'
import { ManagerModule } from '@/shared'
import { TypeCreator, TypeDeleteConfirm, TypeEditor, TypeTable } from './components'
import { TYPE_MANAGER_KEY_MAP, TYPE_MANAGER_OPTIONS } from './definitions'
import { useTypeList } from './hooks'

const { DialogService } = useGlobalDialog()
const getDialogConfig = () => ({
  width: 'fit-content',
  showClose: false,
  alignCenter: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
})

// ==================== 分页参数 ====================
const {
  pagination,
  layout,
  onChange: onPaginationChange,
} = usePagination({
  units: [PgUnit.TOTAL, PgUnit.SIZE, PgUnit.PREV, PgUnit.PAGER, PgUnit.NEXT],
  module: ManagerModule.Type,
})

// ==================== 表格参数 ====================
const typeKey = ref<TypeManagerKeys>('itemType')
const manager = computed(() => TYPE_MANAGER_KEY_MAP[typeKey.value])

// ==================== 分类级别 ====================
const parentPath = ref<unknown[]>([])
const parent = computed(() => parentPath.value.at(-1))

// ==================== 分类列表 ====================
const { typeList, userMap, loading, updateTypeList } = useTypeList({
  manager,
  pagination,
  getParams: () => ({
    node: parent.value,
  }),
})

onPaginationChange(updateTypeList)

const onTypeKeyChange = () => {
  parentPath.value = []
  updateTypeList()
}

const handleNodeSelect = (data?: unknown) => {
  ;(() => {
    if (data === undefined) {
      parentPath.value = []
      return
    }

    const { getId: getKey } = manager.value
    const findIndex = parentPath.value.findIndex(node => getKey(node) === getKey(data))
    if (findIndex > -1) {
      parentPath.value = parentPath.value.slice(0, findIndex + 1)
      updateTypeList()
      return
    }

    parentPath.value.push(data)
  })()

  updateTypeList()
}

// ==================== 添加分类 ====================
const openTypeCreator = () =>
  DialogService.config(getDialogConfig())
    .props({
      parent: parent.value,
      manager: manager.value,
    })
    .listeners({ success: updateTypeList })
    .open(TypeCreator)

// ==================== 编辑分类 ====================
const openTypeEditor = (data: unknown) =>
  DialogService.config(getDialogConfig())
    .props({
      data,
      parent: parent.value,
      manager: manager.value,
    })
    .listeners({ success: updateTypeList })
    .open(TypeEditor)

// ==================== 删除分类 ====================
const confirmDelete = (data: unknown) =>
  DialogService.config(getDialogConfig())
    .props({
      data,
      manager: manager.value,
    })
    .listeners({ success: updateTypeList })
    .open(TypeDeleteConfirm)
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="p-2 flex justify-end border-b-[1px] border-[var(--el-border-color-lighter)]">
      <div class="flex-1 flex items-center gap-2 overflow-hidden">
        <el-select-v2
          v-model="typeKey"
          :options="TYPE_MANAGER_OPTIONS"
          style="width: 140px"
          @change="onTypeKeyChange"
        />

        <el-icon>
          <ArrowRight />
        </el-icon>

        <el-breadcrumb separator="/">
          <el-breadcrumb-item>
            <el-text v-if="!parentPath.length"> 全部 </el-text>
            <el-link v-else @click="() => handleNodeSelect()"> 全部 </el-link>
          </el-breadcrumb-item>
          <el-breadcrumb-item v-for="node in parentPath" :key="manager.getId(node)">
            <el-text v-if="manager.getId(node) === manager.getId(parent)">
              {{ manager.getName(node) }}
            </el-text>
            <el-link v-else @click="() => handleNodeSelect(node)">
              {{ manager.getName(node) }}
            </el-link>
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <div class="flex-shrink-0">
        <el-button text :icon="CirclePlus" @click="openTypeCreator"> 新增 </el-button>
      </div>
    </div>

    <TypeTable
      :data="typeList"
      :user-map="userMap"
      :loading="loading"
      :manager="manager"
      @select-node="handleNodeSelect"
    >
      <template #action="{ row }">
        <el-button circle text :icon="Edit" @click="() => openTypeEditor(row)" />
        <el-button circle text :icon="Delete" type="danger" @click="() => confirmDelete(row)" />
      </template>
    </TypeTable>

    <el-pagination
      v-model:current-page="pagination.current"
      v-model:page-size="pagination.pageSize"
      :disabled="loading"
      :total="pagination.total"
      :layout="layout"
      :pager-count="5"
      :page-sizes="pagination.sizes"
      background
      class="flex justify-end items-center p-2"
    />
  </div>
</template>
