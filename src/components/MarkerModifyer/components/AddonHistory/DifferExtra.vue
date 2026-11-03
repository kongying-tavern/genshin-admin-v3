<script setup lang="ts">
import type { MarkerExtraVo } from '@/api/alova/globals'
import { Right } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'

const props = withDefaults(
  defineProps<{
    history?: MarkerExtraVo
    current?: MarkerExtraVo
    isDifferent?: boolean
  }>(),
  {
    history: () => ({}),
    current: () => ({}),
  },
)

const isIsland16Different = computed(() => {
  const a = new Set(props.current['1_6_island'])
  const b = new Set(props.history['1_6_island'])
  return a.symmetricDifference(b).size > 0
})

const isIsland28Different = computed(() => {
  const a = props.current['2_8_island'] ?? {}
  const b = props.history['2_8_island'] ?? {}
  if (a.island_name !== b.island_name) return true
  const ra = new Set(a.island_state ?? [])
  const rb = new Set(b.island_state ?? [])
  return ra.symmetricDifference(rb).size > 0
})

const isUndergroundDifferent = computed(() => {
  const a = props.current.underground ?? {}
  const b = props.history.underground ?? {}
  if (a.is_underground !== b.is_underground) return true
  const ua = new Set(a.region_levels ?? [])
  const ub = new Set(b.region_levels ?? [])
  return ua.symmetricDifference(ub).size > 0
})

const isIconoverrideDifferent = computed(() => {
  const a = props.current.iconOverride ?? {}
  const b = props.history.iconOverride ?? {}
  return a.id !== b.id || a.maxZoom !== b.maxZoom || a.minZoom !== b.minZoom
})
</script>

<template>
  <div class="w-full overflow-hidden">
    <div v-if="isIsland16Different" class="mb-2">
      <div class="sub-title">海岛 1.6 层级</div>
      <div class="w-full grid grid-cols-[60px_1fr_20px_1fr] leading-5 overflow-hidden">
        <div class="text-xs">层级ID</div>
        <div class="text-xs">
          <div
            v-for="key in history['1_6_island']"
            :key="key"
            :title="key"
            class="w-[139px] overflow-hidden whitespace-nowrap text-ellipsis"
          >
            {{ key }}
          </div>
        </div>
        <ElIcon>
          <Right />
        </ElIcon>
        <div class="text-xs">
          <div
            v-for="key in current['1_6_island']"
            :key="key"
            :title="key"
            class="w-[139px] overflow-hidden whitespace-nowrap text-ellipsis"
          >
            {{ key }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="isIsland28Different" class="mb-2">
      <div class="sub-title">海岛 2.8 层级</div>
      <div class="w-full grid grid-cols-[60px_1fr_20px_1fr] leading-5 overflow-hidden">
        <div class="text-xs">岛屿名称</div>
        <div class="text-xs">
          {{ history['2_8_island']?.island_name }}
        </div>
        <ElIcon>
          <Right />
        </ElIcon>
        <div class="text-xs">
          {{ current['2_8_island']?.island_name }}
        </div>
        <div class="text-xs">岛屿阶段</div>
        <div class="text-xs">
          <div
            v-for="key in history['2_8_island']?.island_state"
            :key="key"
            :title="key"
            class="w-[139px] overflow-hidden whitespace-nowrap text-ellipsis"
          >
            {{ key }}
          </div>
        </div>
        <ElIcon>
          <Right />
        </ElIcon>
        <div class="text-xs">
          <div
            v-for="key in current['2_8_island']?.island_state"
            :key="key"
            :title="key"
            class="w-[139px] overflow-hidden whitespace-nowrap text-ellipsis"
          >
            {{ key }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="isUndergroundDifferent" class="mb-2">
      <div class="sub-title">附加层级</div>
      <div class="w-full grid grid-cols-[60px_1fr_20px_1fr] leading-5 overflow-hidden">
        <div class="text-xs">是否地下</div>
        <div class="text-xs">
          {{ history.underground?.is_underground ?? false }}
        </div>
        <ElIcon>
          <Right />
        </ElIcon>
        <div class="text-xs">
          {{ current.underground?.is_underground ?? false }}
        </div>
        <div class="text-xs">层级ID</div>
        <div class="text-xs">
          <div
            v-for="key in history.underground?.region_levels"
            :key="key"
            :title="key"
            class="w-[139px] overflow-hidden whitespace-nowrap text-ellipsis"
          >
            {{ key }}
          </div>
        </div>
        <ElIcon>
          <Right />
        </ElIcon>
        <div class="text-xs">
          <div
            v-for="key in current.underground?.region_levels"
            :key="key"
            :title="key"
            class="w-[139px] overflow-hidden whitespace-nowrap text-ellipsis"
          >
            {{ key }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="isIconoverrideDifferent" class="mb-2">
      <div class="sub-title">覆盖图标</div>
      <div class="w-full grid grid-cols-[60px_1fr_20px_1fr] leading-5 overflow-hidden">
        <div class="text-xs">tag</div>
        <div class="text-xs">
          {{ history.iconOverride?.id }}
        </div>
        <ElIcon>
          <Right />
        </ElIcon>
        <div class="text-xs">
          {{ current.iconOverride?.id }}
        </div>
        <div class="text-xs">最大缩放</div>
        <div class="text-xs">
          {{ history.iconOverride?.minZoom }}
        </div>
        <ElIcon>
          <Right />
        </ElIcon>
        <div class="text-xs">
          {{ current.iconOverride?.minZoom }}
        </div>
        <div class="text-xs">最小缩放</div>
        <div class="text-xs">
          {{ history.iconOverride?.maxZoom }}
        </div>
        <ElIcon>
          <Right />
        </ElIcon>
        <div class="text-xs">
          {{ current.iconOverride?.maxZoom }}
        </div>
      </div>
    </div>

    <div v-if="!isDifferent" class="text-[var(--el-text-color-secondary)] text-center">无内容</div>
  </div>
</template>

<style scoped>
.sub-title {
  @apply text-xs font-bold;
}
</style>
