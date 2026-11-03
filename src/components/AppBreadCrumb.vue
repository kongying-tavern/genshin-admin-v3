<script lang="ts" setup>
import { ArrowRight } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <el-breadcrumb :separator-icon="ArrowRight" v-bind="$attrs">
    <el-breadcrumb-item v-for="item in route.matched" :key="item.path" :to="item.path">
      <div class="flex items-center gap-1">
        <el-icon v-if="item.meta.icon" :size="16">
          <component :is="item.meta.icon" />
        </el-icon>
        {{ item.meta.title }}
      </div>
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>
