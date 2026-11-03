<script lang="ts" setup>
import type { HistoryVo, SysUserSmallVo } from '@/api/alova/globals'
import type { EditTypeEnum } from '@/shared'
import { AppUserPopover } from '@/components'
import { useUserPopover } from '@/hooks'
import { EDIT_TYPE_MAP } from '@/shared'
import { timeFormatter } from '@/utils'

const props = defineProps<{
  loading: boolean
  data: HistoryVo[]
  userMap: Record<string, SysUserSmallVo>
  historyName: string
}>()

const tableRef = ref<HTMLElement>()
const { height } = useElementSize(tableRef)

const { IDENTIFICATION_SYMBOL, triggerRef, userData, trigger, close } = useUserPopover({
  getUser: userId => props.userMap[userId],
})
</script>

<template>
  <div
    ref="tableRef"
    v-loading="loading"
    element-loading-text="载入中..."
    class="flex-1 overflow-hidden"
    @pointerenter="trigger"
    @pointerleave="close"
  >
    <AppUserPopover :trigger-ref="triggerRef" :data="userData" />

    <el-table :data="data" :height="height" :border="true">
      <el-table-column type="expand" :width="40">
        <template #default="{ row }">
          <pre class="px-2">{{ JSON.parse(row.content) }}</pre>
        </template>
      </el-table-column>

      <el-table-column label="历史记录ID" prop="id" :width="120" />

      <el-table-column :label="`${historyName}ID`" prop="tid" :width="120" />

      <el-table-column label="操作类型" prop="editType" :width="100">
        <template #default="{ row }">
          {{ EDIT_TYPE_MAP[row.editType as EditTypeEnum] }}
        </template>
      </el-table-column>

      <el-table-column label="IP" prop="ipv4" :width="150">
        <template #default="{ row }">
          <pre>{{ row.ipv4 }}</pre>
        </template>
      </el-table-column>

      <el-table-column label="MD5" prop="md5" :width="300">
        <template #default="{ row }">
          <pre>{{ row.md5 }}</pre>
        </template>
      </el-table-column>

      <el-table-column label="用户" prop="creatorId" :width="150">
        <template #default="{ row }">
          <el-tag
            disable-transitions
            :data-symbol="IDENTIFICATION_SYMBOL"
            :data-user-id="row.creatorId"
          >
            {{ userMap[row.creatorId]?.nickname ?? `(id: ${row.creatorId})` }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="操作时间" :width="200" prop="createTime" :formatter="timeFormatter" />
    </el-table>
  </div>
</template>
