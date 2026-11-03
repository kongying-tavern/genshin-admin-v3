<script lang="ts" setup>
import type { ItemVo, SysUserSmallVo } from '@/api/alova/globals'
import { Delete } from '@element-plus/icons-vue'
import { AppRowImage } from '@/components'
import { HiddenFlagEnum, ICON_STYLE_META_MAP } from '@/shared'
import { useAreaStore, useIconStore, useItemTypeStore } from '@/stores'
import { refreshTimeFormatter, timeFormatter } from '@/utils'

defineProps<{
  loading: boolean
  itemList: ItemVo[]
  userMap: Record<string, SysUserSmallVo>
}>()

const emits = defineEmits<{
  selectionChange: [selections: ItemVo[]]
  review: [ItemVo]
  delete: [ItemVo]
}>()

const areaStore = useAreaStore()
const iconStore = useIconStore()
const itemTypeStore = useItemTypeStore()

// ==================== 表格尺寸 ====================
const containerRef = ref<HTMLElement>()
const { height, width } = useElementSize(containerRef)

const getCellClassName = (cell: { column: { property?: string }; rowIndex: number }) => {
  const { property } = cell.column
  if (!property) return ''
  return `prop-${property}`
}

const handleCellClick = (row: ItemVo, col: { property?: string }) => {
  if (col.property !== 'name') return
  emits('review', row)
}

// ==================== 显示类型 ====================
const hiddenFlagMap: Record<number, string> = {
  [HiddenFlagEnum.SHOW]: '显示',
  [HiddenFlagEnum.HIDDEN]: '隐藏',
  [HiddenFlagEnum.BETA]: '测试',
}

// ==================== 事件代理 ====================
const proxySelectionChange = (selections: ItemVo[]) => {
  emits('selectionChange', selections)
}
</script>

<template>
  <div
    ref="containerRef"
    v-loading="loading"
    class="flex-1 overflow-hidden px-2"
    element-loading-text="加载中..."
  >
    <el-table
      :data="itemList"
      :width="width"
      :height="height"
      :cell-class-name="getCellClassName"
      row-key="id"
      class="item-table"
      @selection-change="proxySelectionChange"
      @cell-click="handleCellClick"
    >
      <el-table-column align="center" type="selection" width="50" />

      <el-table-column label="ID" prop="id" width="70" />

      <el-table-column label="图标" width="60">
        <template #default="{ row }">
          <AppRowImage :src="iconStore.idMap.get(row.iconId ?? -1)?.url" />
        </template>
      </el-table-column>

      <el-table-column label="物品名称" prop="name" :width="150" />

      <el-table-column label="图标类型" :width="100">
        <template #default="{ row }">
          {{ ICON_STYLE_META_MAP.get(row.iconStyleType)?.name }}
        </template>
      </el-table-column>

      <el-table-column label="所属地区" width="150">
        <template #default="{ row }">
          <div>{{ areaStore.areaIdMap.get(row.areaId)?.name ?? row.areaId }}</div>
        </template>
      </el-table-column>

      <el-table-column label="物品类型" width="150">
        <template #default="{ row }">
          <el-tag
            v-for="typeId in row.typeIdList"
            :key="typeId"
            disable-transitions
            type="primary"
            class="mr-1"
          >
            {{ itemTypeStore.itemTypeIdMap.get(typeId)?.name ?? 'unknown' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="显示类型" prop="hiddenFlag" width="100">
        <template #default="{ row }">
          {{ hiddenFlagMap[row.hiddenFlag] ?? '未知' }}
        </template>
      </el-table-column>

      <el-table-column label="描述模板" prop="defaultContent" width="500 " show-overflow-tooltip />

      <el-table-column
        label="刷新时间"
        prop="defaultRefreshTime"
        width="100"
        :formatter="refreshTimeFormatter"
      />

      <el-table-column label="最后修改" prop="updateTime" width="170">
        <template #default="{ row }">
          <div>
            {{ timeFormatter(undefined, undefined, row.updateTime) }}
          </div>
          <div
            :title="userMap[row.updaterId]?.nickname"
            class="w-[9rem] overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {{ userMap[row.updaterId]?.nickname ?? `(id: ${row.updaterId})` }}
          </div>
        </template>
      </el-table-column>

      <el-table-column label="创建者" prop="createTime" width="170">
        <template #default="{ row }">
          <div>
            {{ timeFormatter(undefined, undefined, row.createTime) }}
          </div>
          <div
            :title="userMap[row.creatorId]?.nickname"
            class="w-[9rem] overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {{ userMap[row.creatorId]?.nickname ?? `(id: ${row.creatorId})` }}
          </div>
        </template>
      </el-table-column>

      <el-table-column fixed="right" label="操作" :width="60">
        <template #default="{ row }">
          <el-button type="danger" text circle :icon="Delete" @click="() => $emit('delete', row)" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.item-table {
  :deep(.el-table__cell) {
    &.prop-name {
      font-weight: bolder;
      text-decoration: underline 1px dashed;
      text-underline-offset: 4px;
      cursor: pointer;

      &:hover {
        text-decoration-style: solid;
      }
    }
  }
}
</style>
