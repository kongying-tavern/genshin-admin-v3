<script setup lang="ts">
import type { NoticeSearchVo, NoticeVo } from '@/api/alova/globals'
import { PgUnit, useGlobalDialog, usePagination } from '@/hooks'
import { ManagerModule, NoticeChannel } from '@/shared'
import { useArchiveStore } from '@/stores'
import { NoticeDeleteConfirm, NoticeHeader, NoticeTable, NoticeViewer } from './components'
import { useNoticeList } from './hooks'

const archiveStore = useArchiveStore()

const sort = computed({
  get: () => {
    return (
      archiveStore.currentArchive.body.Preference['notice.setting.sort'] ?? [
        'isValid-',
        'sortIndex-',
      ]
    )
  },
  set: v => {
    archiveStore.currentArchive.body.Preference['notice.setting.sort'] = v
  },
})

const {
  pagination,
  layout,
  onChange: onPaginationChange,
} = usePagination({
  units: [PgUnit.TOTAL, PgUnit.SIZE, PgUnit.JUMPER, PgUnit.PREV, PgUnit.PAGER, PgUnit.NEXT],
  module: ManagerModule.Notice,
})

const filterParams = ref<Omit<NoticeSearchVo, 'current' | 'size'>>({
  channels: [
    NoticeChannel.APPLICATION,
    NoticeChannel.CLIENT_APP,
    NoticeChannel.CLIENT_PC,
    NoticeChannel.COMMON,
    NoticeChannel.DADIAN,
    NoticeChannel.DASHBOARD,
    NoticeChannel.WEB,
  ],
  getValid: undefined,
  title: '',
  transformer: '',
})

const { noticeList, loading, refresh } = useNoticeList({
  pagination,
  getParams: () => ({
    ...toValue(filterParams),
    sort: sort.value,
  }),
})

onPaginationChange(refresh)

const { DialogService } = useGlobalDialog()

const handleCreateNotice = () => {
  DialogService.props({
    status: 'create',
  })
    .listeners({
      success: refresh,
    })
    .open(NoticeViewer)
}

const handleReviewNotice = (notice: NoticeVo) => {
  DialogService.props({
    notice,
    status: 'update',
  })
    .listeners({
      success: refresh,
    })
    .open(NoticeViewer)
}

const handleDeleteNotice = (notice: NoticeVo) => {
  DialogService.props({
    title: '删除公告',
    notice,
  })
    .listeners({
      success: refresh,
    })
    .open(NoticeDeleteConfirm)
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <NoticeHeader
      v-model="filterParams"
      v-model:sort="sort"
      v-model:pagination="pagination"
      :data="1"
      @change="refresh"
      @create="handleCreateNotice"
    />

    <NoticeTable
      :data="noticeList"
      :loading="loading"
      @review="handleReviewNotice"
      @delete="handleDeleteNotice"
    />

    <el-pagination
      v-model:current-page="pagination.current"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :layout="layout"
      :page-sizes="pagination.sizes"
      :pager-count="5"
      :disabled="loading"
      class="flex justify-end items-center p-2"
      background
    />
  </div>
</template>
