<script lang="ts" setup>
import type { MarkerVo, SysUserVo } from '@/api/alova/globals'
import { Delete, QuestionFilled, VideoCamera } from '@element-plus/icons-vue'
import { AppBilibiliVideoPlayer } from '@/components'
import { useGlobalDialog } from '@/hooks'
import { HIDDEN_FLAG_NAME_MAP } from '@/shared'
import { useAreaStore, useItemStore } from '@/stores'
import { refreshTimeFormatter } from '@/utils'

defineProps<{
  markerList: MarkerVo[]
  cacheUserInfo: Map<number, SysUserVo>
}>()

defineEmits<{
  delete: [MarkerVo]
}>()

const areaStore = useAreaStore()
const itemStore = useItemStore()

const tableContainerRef = ref<HTMLElement>()
const { width, height } = useElementSize(tableContainerRef)

const { DialogService } = useGlobalDialog()

const playBilibiliVideo = (row: MarkerVo) => {
  DialogService.props({
    url: row.videoPath,
    width: 640,
    height: 360,
  }).open(AppBilibiliVideoPlayer)
}

const getItemAreaNames = ({ itemList = [] }: MarkerVo) => {
  return itemList.reduce((set, { itemId }) => {
    const item = itemStore.itemIdMap.get(itemId!)
    if (!item) return set.add(`(itemId: ${itemId})`)

    const area = areaStore.areaIdMap.get(item.areaId!)
    if (!area) return set.add(`(itemId: ${itemId})`)

    return set.add(area.name ?? `(areaId: ${area.id!})`)
  }, new Set<string>())
}
</script>

<template>
  <div ref="tableContainerRef" class="flex-1 overflow-hidden px-2">
    <el-table
      :data="markerList"
      :width="width"
      :max-height="height"
      :height="height"
      class="marker-table"
    >
      <el-table-column prop="id" label="ID" :width="100" />

      <el-table-column prop="markerTitle" label="名称" :width="150" show-overflow-tooltip />

      <el-table-column label="地区" :width="200">
        <template #default="{ row }">
          <el-tag
            v-for="name in getItemAreaNames(row)"
            :key="name"
            :title="name"
            disable-transitions
          >
            {{ name }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="content" label="描述" show-overflow-tooltip />

      <el-table-column prop="picture" label="图片" class-name="compact" :width="53">
        <template #default="{ row }">
          <el-image
            :src="row.picture"
            :z-index="5000"
            :preview-src-list="[row.picture]"
            style="width: 52px; height: 52px"
            preview-teleported
          >
            <template #error>
              <div class="w-full h-full grid place-content-center place-items-center gap-2">
                <el-icon :size="30">
                  <QuestionFilled />
                </el-icon>
              </div>
            </template>
          </el-image>
        </template>
      </el-table-column>

      <el-table-column prop="videoPath" align="center" label="视频" :width="100">
        <template #default="{ row }">
          <el-button
            v-if="row.videoPath"
            text
            :icon="VideoCamera"
            @click="() => playBilibiliVideo(row)"
          />
          <div v-else>无</div>
        </template>
      </el-table-column>

      <el-table-column prop="creator.nickname" label="创建者" :width="150">
        <template #default="{ row }">
          {{ cacheUserInfo.get(row.creatorId)?.nickname ?? `(id: ${row.creatorId})` }}
        </template>
      </el-table-column>

      <el-table-column
        prop="refreshTime"
        label="刷新类型"
        :formatter="refreshTimeFormatter"
        :width="150"
      />

      <el-table-column prop="hiddenFlag" label="flag" :width="90">
        <template #default="{ row }">
          {{ HIDDEN_FLAG_NAME_MAP[row.hiddenFlag] ?? 'unknown' }}
        </template>
      </el-table-column>

      <el-table-column label="操作" :width="100" header-align="center" align="center">
        <template #default="{ row }">
          <el-button
            circle
            text
            type="danger"
            :icon="Delete"
            style="
              --el-fill-color: var(--el-color-danger-light-7);
              --el-fill-color-light: var(--el-color-danger-light-9);
            "
            @click="() => $emit('delete', row)"
          />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.marker-table {
  :deep(.el-table__body-wrapper .el-table__cell.compact) {
    padding: 0;
    .cell {
      padding: 0;
      line-height: 0;
    }
  }
}
</style>
