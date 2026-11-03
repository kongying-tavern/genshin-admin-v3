<script lang="ts" setup>
import type { AreaVo, SysUserSmallVo } from '@/api/alova/globals'
import { AppRowImage, AppUserPopover } from '@/components'
import { useUserPopover } from '@/hooks'
import { useIconStore } from '@/stores'
import { timeFormatter } from '@/utils'

const props = defineProps<{
  areaList: AreaVo[]
  loading: boolean
  userMap: Record<string, SysUserSmallVo>
  parentPath: AreaVo[]
}>()

const emits = defineEmits<{
  selectionChange: [selections: AreaVo[]]
  'update:parentPath': [path: AreaVo[]]
}>()

const tableContainerRef = ref<HTMLElement>()
const { height } = useElementSize(tableContainerRef)

const iconStore = useIconStore()

const { IDENTIFICATION_SYMBOL, userData, triggerRef, trigger, close } = useUserPopover({
  getUser: userId => props.userMap[userId],
})

const proxySelectionChange = (areas: AreaVo[]) => emits('selectionChange', areas)

const typeAssert = (row: unknown) => row as AreaVo
</script>

<template>
  <div
    ref="tableContainerRef"
    v-loading="loading"
    class="flex-1 overflow-hidden"
    element-loading-text="加载中..."
    @pointerenter="trigger"
    @pointerleave="close"
  >
    <AppUserPopover :trigger-ref="triggerRef" :data="userData" />

    <el-table
      :data="areaList"
      :max-height="height"
      :height="height"
      :border="true"
      cell-class-name="whitespace-nowrap"
      style="width: 100%"
      @selection-change="proxySelectionChange"
    >
      <el-table-column type="selection" align="center" :width="50" />

      <el-table-column label="ID" prop="id" :width="60" />

      <el-table-column label="图标" :width="60">
        <template #default="{ row }">
          <AppRowImage :src="iconStore.idMap.get(row.iconId ?? -1)?.url" />
        </template>
      </el-table-column>

      <el-table-column prop="name" label="名称" :width="150">
        <template #default="{ row }">
          <el-link
            v-if="parentPath.length < 1"
            type="primary"
            @click="() => emits('update:parentPath', [row])"
          >
            {{ row.name }}
          </el-link>
          <template v-else>
            {{ row.name }}
          </template>
        </template>
      </el-table-column>

      <el-table-column prop="code" label="地区代码" :width="160" />

      <el-table-column prop="content" label="地区描述" :width="150" />

      <el-table-column prop="sortIndex" label="地区排序" :width="90" />

      <el-table-column label="创建人" :width="120">
        <template #default="{ row }">
          <el-tag
            :data-symbol="IDENTIFICATION_SYMBOL"
            :data-user-id="row.creatorId"
            disable-transitions
          >
            {{ userMap[row.creatorId]?.nickname ?? `(id: ${row.creatorId})` }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="createTime" label="创建时间" :width="170" :formatter="timeFormatter" />

      <el-table-column label="修改人" :width="120">
        <template #default="{ row }">
          <el-tag
            :data-symbol="IDENTIFICATION_SYMBOL"
            :data-user-id="row.updaterId"
            disable-transitions
          >
            {{ userMap[row.updaterId]?.nickname ?? `(id: ${row.updaterId})` }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="updateTime" label="修改时间" :width="170" :formatter="timeFormatter" />

      <el-table-column fixed="right" label="操作" :width="130">
        <template #default="{ $index, row }">
          <slot name="action" :index="$index" :row="typeAssert(row)" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
