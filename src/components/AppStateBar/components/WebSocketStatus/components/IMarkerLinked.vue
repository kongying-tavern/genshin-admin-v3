<script setup lang="ts">
import type { MarkerVo } from '@/api/alova/globals'
import dayjs from 'dayjs'
import { AppIconTagRenderer } from '@/components'
import { useMarkerControl } from '@/hooks'
import { LINK_ACTION_NAME_MAP, LINK_CONFIG_MAP, LinkActionEnum } from '@/shared/linkAction'
import { useIconStore, useItemStore, useMarkerLinkStore } from '@/stores'
import { pickMainItem } from '@/utils'

const props = defineProps<{
  data: Socket.DataEventRecord<'MarkerLinked'>
}>()

const itemStore = useItemStore()
const iconStore = useIconStore()
const markerLinkStore = useMarkerLinkStore()

const { focusMarker } = useMarkerControl()

const markers = computed(() => {
  const [markerList] = props.data.args
  return markerList ?? []
})

/** 获取关联类型 */
const linkAction = computed(() => {
  const firstMarker = markers.value[0]
  if (!firstMarker?.linkageId) return LinkActionEnum.RELATED

  const linkGroup = markerLinkStore.groupIdMap.get(firstMarker.linkageId)
  if (!linkGroup?.length) return LinkActionEnum.RELATED

  return (linkGroup[0].linkAction as LinkActionEnum) ?? LinkActionEnum.RELATED
})

/** 关联类型名称 */
const linkActionName = computed(() => {
  return LINK_ACTION_NAME_MAP.get(linkAction.value) ?? '关联'
})

/** 关联类型配色 */
const linkColor = computed(() => {
  const config = LINK_CONFIG_MAP.get(linkAction.value)
  if (!config) return 'rgb(0, 170, 255)'

  const [r, g, b] = config.lineColor
  return `rgb(${r}, ${g}, ${b})`
})

/** 关联类型配色（浅色背景） */
const linkColorLight = computed(() => {
  const config = LINK_CONFIG_MAP.get(linkAction.value)
  if (!config) return 'rgba(0, 170, 255, 0.1)'

  const [r, g, b] = config.lineColor
  return `rgba(${r}, ${g}, ${b}, 0.1)`
})

/** 关联类型配色（悬停背景） */
const linkColorHover = computed(() => {
  const config = LINK_CONFIG_MAP.get(linkAction.value)
  if (!config) return 'rgba(0, 170, 255, 0.15)'

  const [r, g, b] = config.lineColor
  return `rgba(${r}, ${g}, ${b}, 0.15)`
})

const getIconId = (marker: MarkerVo) => {
  const { mainIconId } = pickMainItem(marker, itemStore.itemIdMap)
  return mainIconId
}
</script>

<template>
  <div class="p-2 rounded-lg select-none">
    <div class="text-[var(--el-text-color-secondary)] mb-2">关联点位</div>

    <div class="flex flex-col items-center">
      <template v-for="(marker, index) in markers" :key="marker.id">
        <!-- 点位卡片 -->
        <div
          class="w-full flex items-center gap-2 p-2 px-3 rounded-lg cursor-pointer border-l-[3px] transition-colors"
          :style="{
            borderColor: linkColor,
            backgroundColor: linkColorLight,
          }"
          @mouseenter="($event.currentTarget as HTMLElement).style.backgroundColor = linkColorHover"
          @mouseleave="($event.currentTarget as HTMLElement).style.backgroundColor = linkColorLight"
          @click="() => focusMarker(marker)"
        >
          <AppIconTagRenderer
            :src="iconStore.iconTextureUrl"
            :mapping="iconStore.iconCoordMap.get(getIconId(marker))"
            class="w-9 h-9 rounded-full bg-[color-mix(in_srgb,var(--el-text-color-primary)_10%,transparent_90%)]"
          />
          <div class="flex-1 min-w-0">
            <div class="font-bold truncate">
              {{ marker.markerTitle }}
            </div>
            <div class="text-[var(--el-text-color-secondary)]">
              {{ `ID: ${marker.id}` }}
            </div>
          </div>
        </div>

        <!-- 连线和关联类型标签 -->
        <div v-if="index < markers.length - 1" class="flex flex-col items-center py-1">
          <!-- 上连线 -->
          <div class="w-[2px] h-3" :style="{ backgroundColor: linkColor }" />
          <!-- 关联类型标签 -->
          <div
            class="px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap my-0.5"
            :style="{
              color: linkColor,
              borderColor: linkColor,
              backgroundColor: 'var(--el-bg-color)',
            }"
          >
            {{ linkActionName }}
          </div>
          <!-- 下连线 -->
          <div class="w-[2px] h-3" :style="{ backgroundColor: linkColor }" />
        </div>
      </template>
    </div>

    <div class="text-[var(--el-text-color-secondary)] mt-2">
      {{ dayjs(data.time).format('YYYY-MM-DD HH:mm:ss') }}
    </div>
  </div>
</template>
