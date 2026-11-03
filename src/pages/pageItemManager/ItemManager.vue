<script lang="ts" setup>
import type { ItemQueryForm } from './hooks'
import type { ItemVo } from '@/api/alova/globals'
import { PgUnit, useGlobalDialog, usePagination } from '@/hooks'
import { ManagerModule } from '@/shared'
import {
  ItemCreator,
  ItemDeleteConfirm,
  ItemEditor,
  ItemFilter,
  ItemGridExplorer,
  ItemTable,
} from './components'
import { useItemList } from './hooks'
import { ExplorerType } from './shared'

const { DialogService } = useGlobalDialog()

const COMMON_CONFIG = {
  alignCenter: true,
  closeOnClickModal: false,
  closeOnPressEscape: false,
  showClose: false,
}

// ==================== 筛选信息 ====================
const {
  pagination,
  layout,
  onChange: onPaginationChange,
} = usePagination({
  units: [PgUnit.TOTAL, PgUnit.SIZE, PgUnit.PREV, PgUnit.PAGER, PgUnit.NEXT],
  module: ManagerModule.Item,
})

const queryForm = ref<ItemQueryForm>({
  name: '',
  areaId: undefined,
  itemTypeId: undefined,
})

// ==================== 物品列表 ====================
const {
  itemList,
  loading: itemLoading,
  userMap,
  updateItemList,
  resetCurrent,
} = useItemList({
  pagination,
  getParams: () => toValue(queryForm),
})

onPaginationChange(updateItemList)

// ==================== 物品表格 ====================
const explorerType = ref<ExplorerType>(ExplorerType.Grid)

// ==================== 新增物品 ====================
const openItemCreatorDialog = () => {
  DialogService.config(COMMON_CONFIG).listeners({ success: updateItemList }).open(ItemCreator)
}

// ==================== 编辑物品 ====================
const openItemEditorDialog = (item: ItemVo) => {
  DialogService.config(COMMON_CONFIG)
    .props({ item })
    .listeners({ success: updateItemList })
    .open(ItemEditor)
}

// ==================== 删除物品 ====================

const confirmDelete = (item: ItemVo) => {
  DialogService.config(COMMON_CONFIG)
    .props({ item })
    .listeners({ success: updateItemList })
    .open(ItemDeleteConfirm)
}
</script>

<template>
  <div class="h-full flex-1 flex flex-col overflow-hidden">
    <ItemFilter
      v-model="queryForm"
      v-model:explorer-type="explorerType"
      :loading="itemLoading"
      @change="resetCurrent"
      @create="openItemCreatorDialog"
      @refresh="updateItemList"
    />

    <component
      :is="explorerType === ExplorerType.List ? ItemTable : ItemGridExplorer"
      :item-list="itemList"
      :loading="itemLoading"
      :user-map="userMap"
      @review="openItemEditorDialog"
      @delete="confirmDelete"
    />

    <el-pagination
      v-model:current-page="pagination.current"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :layout="layout"
      :page-sizes="pagination.sizes"
      :pager-count="5"
      :disabled="itemLoading"
      class="flex justify-end items-center p-2"
      background
    />
  </div>
</template>
