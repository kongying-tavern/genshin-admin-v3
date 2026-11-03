<script setup lang="ts">
import type { MarkerVo } from '@/api/alova/globals.js'
import DifferCoord from './DifferCoord.vue'
import DifferExtra from './DifferExtra.vue'
import DifferHiddenFlag from './DifferHiddenFlag.vue'
import DifferImage from './DifferImage.vue'
import DifferItem from './DifferItem.vue'
import DifferRefreshTime from './DifferRefreshTime.vue'
import DifferText from './DifferText.vue'
import HistoryDifferItem from './HistoryDifferItem.vue'

const props = defineProps<{
  loading?: boolean
  diffs?: Set<string>
  newContent: MarkerVo
  oldContent: MarkerVo
  autoCollapse?: boolean
}>()

const rewriteSet = new (class RewriteSet extends Set<string> {
  has = () => {
    return true
  }
})()

const difference = computed(() => {
  if (!props.diffs) return rewriteSet
  return props.diffs
})
</script>

<template>
  <el-skeleton :rows="5" :loading="loading" animated>
    <template #default>
      <HistoryDifferItem
        label="点位名称"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('markerTitle')"
      >
        <DifferText :current="newContent.markerTitle" :history="oldContent.markerTitle" />
      </HistoryDifferItem>

      <HistoryDifferItem
        label="附加信息"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('extra')"
      >
        <template #default="{ isDifferent }">
          <DifferExtra
            :current="newContent.extra"
            :history="oldContent.extra"
            :is-different="isDifferent"
          />
        </template>
      </HistoryDifferItem>

      <HistoryDifferItem
        label="所属物品"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('itemList')"
      >
        <DifferItem :current="newContent.itemList" :history="oldContent.itemList" />
      </HistoryDifferItem>

      <HistoryDifferItem
        label="点位描述"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('content')"
      >
        <DifferText :current="newContent.content" :history="oldContent.content" />
      </HistoryDifferItem>

      <HistoryDifferItem
        label="点位坐标"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('position')"
      >
        <DifferCoord :current="newContent.position" :history="oldContent.position" />
      </HistoryDifferItem>

      <HistoryDifferItem
        label="点位图像"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('picture')"
      >
        <DifferImage :current="newContent.picture" :history="oldContent.picture" />
      </HistoryDifferItem>

      <HistoryDifferItem
        label="显示状态"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('hiddenFlag')"
      >
        <DifferHiddenFlag :current="newContent.hiddenFlag" :history="oldContent.hiddenFlag" />
      </HistoryDifferItem>

      <HistoryDifferItem
        label="刷新时间"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('refreshTime')"
      >
        <DifferRefreshTime :current="newContent.refreshTime" :history="oldContent.refreshTime" />
      </HistoryDifferItem>

      <HistoryDifferItem
        label="视频链接"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('videoPath')"
      >
        <DifferText :current="newContent.videoPath" :history="oldContent.videoPath" />
      </HistoryDifferItem>

      <HistoryDifferItem
        label="点位关联"
        :auto-collapse="autoCollapse"
        :is-different="difference.has('linkageId')"
      >
        <div class="text-xs">
          旧关联组 ID:
          {{ oldContent.linkageId === undefined ? 'undefined' : `"${oldContent.linkageId}"` }}
        </div>
        <div class="text-xs">
          新关联组 ID:
          {{ newContent.linkageId === undefined ? 'undefined' : `"${newContent.linkageId}"` }}
        </div>
      </HistoryDifferItem>
    </template>
  </el-skeleton>
</template>
