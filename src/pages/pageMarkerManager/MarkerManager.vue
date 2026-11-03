<script lang="ts" setup>
import type { MarkerSearchParams } from './hooks'
import type { MarkerVo } from '@/api/alova/globals'
import { ref } from 'vue'
import { PgUnit, useGlobalDialog, usePagination } from '@/hooks'
import { ManagerModule } from '@/shared'
import { MarkerDeleteConfirm, MarkerFilter, MarkerTable } from './components'
import { useItemList, useSearchMarkerList } from './hooks'

// ==================== 搜索 ====================
const queryForm = ref<MarkerSearchParams>({
  areaIdList: [],
  itemIdList: [],
  typeIdList: [],
  markerIdList: [],
})

// ==================== 分页 ====================
const {
  layout,
  pagination,
  onChange: onPaginationChange,
} = usePagination({
  units: [PgUnit.TOTAL, PgUnit.SIZE, PgUnit.PREV, PgUnit.PAGER, PgUnit.NEXT],
  module: ManagerModule.Marker,
})

// ==================== 点位 ====================
const { markerList, cacheUserInfo, updateMarkerList } = useSearchMarkerList({
  pagination,
  getParams: () => queryForm.value,
})

onPaginationChange(updateMarkerList)

const resetCurrentRefresh = async () => {
  pagination.value.current = 1
  await updateMarkerList()
}

// ==================== 物品 ====================
const { itemOptions } = useItemList({
  params: () => ({
    areaIdList: queryForm.value.areaIdList,
    typeIdList: queryForm.value.typeIdList,
  }),
})

// 当已选物品不存在于物品选项中时，重置已选物品
watch(itemOptions, options => {
  for (const itemId of queryForm.value.itemIdList) {
    if (!options.find(opt => opt.value === itemId)) {
      queryForm.value.itemIdList = []
      return
    }
  }
})

const { DialogService } = useGlobalDialog()

const handleDeleteMarker = (marker: MarkerVo) => {
  DialogService.config({
    alignCenter: true,
    closeOnClickModal: false,
    closeOnPressEscape: false,
  })
    .props({
      title: '删除点位',
      marker,
    })
    .listeners({
      success: updateMarkerList,
    })
    .open(MarkerDeleteConfirm)
}
</script>

<template>
  <div class="h-full flex-1 flex flex-col overflow-hidden">
    <MarkerFilter v-model="queryForm" @change="resetCurrentRefresh" />

    <MarkerTable
      :marker-list="markerList"
      :cache-user-info="cacheUserInfo"
      @delete="handleDeleteMarker"
    />

    <el-pagination
      v-model:current-page="pagination.current"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :layout="layout"
      :page-sizes="[10, 20, 30]"
      :pager-count="5"
      class="flex justify-end items-center p-2"
      background
    />
  </div>
</template>
