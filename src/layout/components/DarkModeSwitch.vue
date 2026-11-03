<script setup lang="ts">
import { Moon, Sunny } from '@element-plus/icons-vue'
import { useTheme } from '@/hooks'

const { isDark } = useTheme()
</script>

<template>
  <el-switch
    v-model="isDark"
    :active-action-icon="Moon"
    :inactive-action-icon="Sunny"
    style="--el-switch-on-color: var(--el-fill-color-darker); padding: 8px 12px"
  />
</template>
