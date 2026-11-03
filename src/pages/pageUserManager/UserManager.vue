<script lang="ts" setup>
import type { SysUserVo } from '@/api/alova/globals'
import { CirclePlus } from '@element-plus/icons-vue'
import { PgUnit, useGlobalDialog, usePagination } from '@/hooks'
import { ManagerModule } from '@/shared'
import { UserCreator, UserFilter, UserIntegratedPanel, UserTable } from './components'
import { useUserList } from './hooks'

const { DialogService } = useGlobalDialog()

const {
  pagination,
  layout,
  onChange: onPaginationChange,
} = usePagination({
  units: [PgUnit.TOTAL, PgUnit.SIZE, PgUnit.JUMPER, PgUnit.PREV, PgUnit.PAGER, PgUnit.NEXT],
  module: ManagerModule.User,
})

const sortInfo = ref({
  key: 'id',
  type: '+',
})

const { userList, loading, filterKey, filterValue, filterRoleIds, updateUserList, resetCurrent } =
  useUserList({
    pagination,
    sortInfo,
  })

onPaginationChange(updateUserList)

// ==================== 新增用户 ====================
const openUserCreator = () => DialogService.listeners({ success: updateUserList }).open(UserCreator)

// ==================== 编辑用户 ====================
const openUserEditor = (data: SysUserVo) =>
  DialogService.props({ data })
    .listeners({
      success: updateUserList,
    })
    .open(UserIntegratedPanel)
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <UserFilter
      v-model="filterValue"
      v-model:sort-info="sortInfo"
      v-model:filter-key="filterKey"
      v-model:filter-role-ids="filterRoleIds"
      @change="resetCurrent"
    >
      <template #footer>
        <el-button text :icon="CirclePlus" @click="openUserCreator"> 新增 </el-button>
      </template>
    </UserFilter>

    <UserTable :data="userList" :loading="loading" @view-row="openUserEditor" />

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
