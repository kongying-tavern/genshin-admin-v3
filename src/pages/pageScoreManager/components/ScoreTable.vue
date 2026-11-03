<script lang="ts" setup>
import type { FormatedScore } from '../shared'

defineProps<{
  loading: boolean
  data: FormatedScore[]
}>()

const tableRef = ref<HTMLElement>()
const { height } = useElementSize(tableRef)
</script>

<template>
  <div ref="tableRef" v-loading="loading" element-loading-text="载入中..." class="overflow-hidden">
    <el-table :data="data" :height="height" :border="true" table-layout="auto">
      <el-table-column align="center" label="用户">
        <el-table-column align="center" label="ID" prop="userId" width="60px" />
        <el-table-column align="center" label="用户名" prop="username" width="130px" />
        <el-table-column align="center" label="昵称" prop="nickname" width="200px" />
      </el-table-column>
      <el-table-column align="center" label="字数统计">
        <el-table-column align="center" label="标题" prop="data.chars.markerTitle" />
        <el-table-column align="center" label="内容" prop="data.chars.content" />
      </el-table-column>
      <el-table-column align="center" label="次数统计">
        <el-table-column align="center" label="标题" prop="data.fields.markerTitle" />
        <el-table-column align="center" label="内容" prop="data.fields.content" />
        <el-table-column align="center" label="位置" prop="data.fields.position" />
        <el-table-column align="center" label="隐藏标志" prop="data.fields.hiddenFlag" />
        <el-table-column align="center" label="刷新时间" prop="data.fields.refreshTime" />
        <el-table-column align="center" label="图片" prop="data.fields.picture" />
        <el-table-column align="center" label="视频" prop="data.fields.videoPath" />
      </el-table-column>
    </el-table>
  </div>
</template>
