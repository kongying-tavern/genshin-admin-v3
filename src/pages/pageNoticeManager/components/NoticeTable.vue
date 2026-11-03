<script lang="ts" setup>
import type { NoticeVo } from '@/api/alova/globals'
import { Delete } from '@element-plus/icons-vue'
import { NOTICE_NAME_MAP, now } from '@/shared'
import { timeFormatter } from '@/utils'

const props = defineProps<{
  loading: boolean
  data: NoticeVo[]
}>()

const emits = defineEmits<{
  review: [v: NoticeVo]
  delete: [v: NoticeVo]
}>()

const covertNoticeList = computed(() =>
  props.data.map(notice => ({
    ...notice,
    time: {
      start: notice.validTimeStart ? new Date(notice.validTimeStart).getTime() : undefined,
      end: notice.validTimeEnd ? new Date(notice.validTimeEnd).getTime() : undefined,
    },
  })),
)

const stateList = computed(() => {
  const nowTime = now.value
  return covertNoticeList.value.map(({ time: { start, end } }) => {
    let state: { label: string; type: 'success' | 'warning' | 'info' } = {
      label: '生效中',
      type: 'success',
    }
    if (start && start > nowTime) state = state = { label: '待生效', type: 'warning' }
    if (end && end < nowTime) state = state = { label: '已失效', type: 'info' }
    return state
  })
})

const getCellClassName = (cell: { column: { property?: string }; rowIndex: number }) => {
  const { property } = cell.column
  if (!property) return ''
  return `is-${property} is-${stateList.value[cell.rowIndex].type}`
}

const handleCellClick = (row: NoticeVo, col: { property?: string }) => {
  if (col.property !== 'title') return
  emits('review', row)
}

const contentFormatter = (...{ 2: value = '' }) => {
  const parser = new DOMParser()
  const { firstChild } = parser.parseFromString(value, 'text/html')
  const content = firstChild instanceof HTMLElement ? (firstChild.textContent ?? '') : ''
  return content.length > 50 ? `${content.slice(0, 50)}...` : content
}

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
    <el-table
      :data="data"
      :height="height"
      :cell-class-name="getCellClassName"
      table-layout="auto"
      class="notice-table"
      @cell-click="handleCellClick"
    >
      <el-table-column prop="status" label="状态" :width="81">
        <template #default="{ $index }">
          <el-tag :type="stateList[$index].type" disable-transitions>
            {{ stateList[$index].label }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="title" label="标题" :min-width="150" show-overflow-tooltip />

      <el-table-column
        prop="content"
        label="内容"
        show-overflow-tooltip
        :width="300"
        :formatter="contentFormatter"
      />

      <el-table-column prop="channel" label="频道" :width="200">
        <template #default="{ row }">
          <div v-if="row.channel?.length" class="flex flex-wrap gap-1">
            <el-tag v-for="channel in row.channel" :key="channel" disable-transitions>
              {{ NOTICE_NAME_MAP.get(channel) ?? channel }}
            </el-tag>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="sortIndex" label="排序" :width="80" />

      <el-table-column
        prop="validTimeStart"
        label="生效时间"
        :width="170"
        :formatter="timeFormatter"
      />

      <el-table-column
        prop="validTimeEnd"
        label="失效时间"
        :width="170"
        :formatter="timeFormatter"
      />

      <el-table-column label="操作" :width="100" header-align="center" align="center">
        <template #default="scope">
          <el-button
            circle
            text
            :icon="Delete"
            type="danger"
            style="
              --el-fill-color: var(--el-color-danger-light-7);
              --el-fill-color-light: var(--el-color-danger-light-9);
            "
            @click="() => $emit('delete', scope.row)"
          />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.notice-table {
  :deep(.el-table__cell) {
    padding: 8px 0;

    &.is-title {
      font-weight: bolder;
      text-decoration: underline 1px dashed;
      text-underline-offset: 4px;
      cursor: pointer;

      &:hover {
        text-decoration-style: solid;
      }

      &.is-success {
        color: var(--el-color-success);
      }
      &.is-info {
        color: var(--el-color-info);
      }
      &.is-warning {
        color: var(--el-color-warning);
      }
    }
  }
}
</style>
