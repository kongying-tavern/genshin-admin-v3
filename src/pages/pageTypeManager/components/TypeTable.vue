<script lang="ts" setup generic="T">
import type { TypeManager } from '../config'
import type { SysUserSmallVo } from '@/api/alova/globals'
import { ElTable } from 'element-plus'
import { AppRowImage, AppUserPopover } from '@/components'
import { useUserPopover } from '@/hooks'
import { HIDDEN_FLAG_NAME_MAP } from '@/shared'
import { useIconStore } from '@/stores'
import { timeFormatter } from '@/utils'

const props = defineProps<{
  data: T[]
  userMap: Record<string, SysUserSmallVo>
  loading: boolean
  manager: TypeManager<T>
}>()

defineEmits<{
  selectNode: [T]
}>()

const iconStore = useIconStore()

const tableContainerRef = ref<HTMLElement>()
const { height } = useElementSize(tableContainerRef)

const tableRef = ref<InstanceType<typeof ElTable> | null>(null)
watch(
  () => props.data,
  () =>
    tableRef.value?.scrollTo({
      top: 0,
    }),
)

const { IDENTIFICATION_SYMBOL, triggerRef, userData, trigger, close } = useUserPopover({
  getUser: userId => props.userMap[userId],
})
</script>

<template>
  <div
    ref="tableContainerRef"
    v-loading="loading"
    class="flex-1 px-2 overflow-hidden"
    element-loading-text="加载中..."
    @pointerover="trigger"
    @pointerout="close"
  >
    <AppUserPopover :trigger-ref="triggerRef" :data="userData" />

    <ElTable
      ref="tableRef"
      :data="data"
      :max-height="height"
      :height="height"
      :row-key="row => `${manager.getId(row)}`"
      cell-class-name="whitespace-nowrap"
    >
      <el-table-column label="ID" prop="id" :width="80" />

      <el-table-column label="图标" prop="iconId" :width="60">
        <template #default="{ row }">
          <AppRowImage :src="iconStore.idMap.get(row.iconId ?? -1)?.url" />
        </template>
      </el-table-column>

      <el-table-column label="名称" prop="name">
        <template #default="{ row }">
          <el-link type="primary" @click="() => $emit('selectNode', row)">
            {{ row.name }}
          </el-link>
        </template>
      </el-table-column>

      <el-table-column label="可见性" prop="hiddenFlag">
        <template #default="{ row }">
          <div
            :class="{
              'text-[var(--el-text-color-disabled)]':
                HIDDEN_FLAG_NAME_MAP[row.hiddenFlag] === undefined,
            }"
          >
            {{ HIDDEN_FLAG_NAME_MAP[row.hiddenFlag] ?? '缺省' }}
          </div>
        </template>
      </el-table-column>

      <el-table-column label="子分类" :width="80">
        <template #default="{ row }">
          {{ manager.getIsLeaf(row) ? '无' : '有' }}
        </template>
      </el-table-column>

      <el-table-column label="创建人" prop="creatorId" :width="160">
        <template #default="{ row }">
          <el-tag
            v-if="userMap[row.creatorId]"
            :data-symbol="IDENTIFICATION_SYMBOL"
            :data-user-id="row.creatorId"
            disable-transitions
          >
            {{ userMap[row.creatorId]?.nickname ?? `(id: ${row.creatorId})` }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="创建时间" prop="createTime" :formatter="timeFormatter" :width="180" />

      <el-table-column label="修改人" prop="updaterId" :width="160">
        <template #default="{ row }">
          <el-tag
            v-if="userMap[row.updaterId]"
            :data-symbol="IDENTIFICATION_SYMBOL"
            :data-user-id="row.updaterId"
            disable-transitions
          >
            {{ userMap[row.updaterId]?.nickname ?? `(id: ${row.updaterId})` }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="修改时间" prop="updateTime" :formatter="timeFormatter" :width="180" />

      <el-table-column label="操作" :width="100">
        <template #default="{ row }">
          <slot name="action" :row="row" />
        </template>
      </el-table-column>
    </ElTable>
  </div>
</template>
