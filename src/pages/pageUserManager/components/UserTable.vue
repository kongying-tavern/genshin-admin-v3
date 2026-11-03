<script lang="ts" setup generic="T">
import { useUserStore } from '@/stores'
import { timeFormatter } from '@/utils'

defineProps<{
  loading: boolean
  data: T[]
}>()

const emits = defineEmits<{
  viewRow: [T]
}>()

const userStore = useUserStore()

const tableRef = ref<HTMLElement>()
const { height } = useElementSize(tableRef)
</script>

<template>
  <div
    ref="tableRef"
    v-loading="loading"
    element-loading-text="载入中..."
    class="flex-1 overflow-hidden px-2"
  >
    <el-table :data="data" :height="height" table-layout="auto">
      <el-table-column label="ID" prop="id" :width="80" />

      <el-table-column label="头像" :width="80">
        <template #default="{ row }">
          <div
            class="w-10 h-10 rounded border border-[var(--el-color-primary-light-8)] bg-[var(--el-color-primary-light-9)]"
          >
            <img v-if="row.logo" class="w-full h-full object-contain" :src="row.logo" />
          </div>
        </template>
      </el-table-column>

      <el-table-column label="用户名" prop="username" :width="150">
        <template #default="{ row }">
          <div
            class="text-[var(--el-color-primary)] underline underline-offset-4 decoration-[var(--el-color-primary)] decoration-dashed hover:decoration-solid cursor-pointer"
            @click="() => emits('viewRow', row)"
          >
            {{ row.username }}
          </div>
        </template>
      </el-table-column>

      <el-table-column label="昵称" prop="nickname" :width="200" show-overflow-tooltip />

      <el-table-column label="备注" prop="remark" :width="200" show-overflow-tooltip />

      <el-table-column label="角色" prop="roleId" :width="150">
        <template #default="{ row }">
          <el-tag disable-transitions>
            {{ userStore.roleMap.get(row.roleId!)?.name ?? '...' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="QQ" prop="qq" :width="150" />

      <el-table-column label="手机号" prop="phone" :width="150" />

      <el-table-column label="修改时间" prop="updateTime" :formatter="timeFormatter" />
    </el-table>
  </div>
</template>
