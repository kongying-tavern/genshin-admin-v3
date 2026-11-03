<script setup lang="ts">
import type { TagProps } from 'element-plus'
import type { ItemVo } from '@/api/alova/globals'
import { Delete } from '@element-plus/icons-vue'
import { AppIconTagRenderer } from '@/components'
import { useBinaryFlag, useRefreshTime } from '@/hooks'
import { HIDDEN_FLAG_NAME_MAP, HiddenFlagEnum, ICON_STYLE_META_MAP, IconStyle } from '@/shared'
import { useAreaStore, useIconStore } from '@/stores'
import UnknownIconUrl from '/icons/unknown.webp?url'

const props = defineProps<{
  data: ItemVo
  count?: number
}>()

const emits = defineEmits<{
  delete: [ItemVo]
  review: [ItemVo]
}>()

const areaStore = useAreaStore()
const iconStore = useIconStore()

const areaName = computed(() => {
  const { areaId } = props.data
  return areaStore.areaIdMap.get(areaId!)?.name ?? `(AreaId: ${areaId})`
})

const { isCaveEntrance, isIconCustomizable, isTeleportable } = useBinaryFlag(
  computed(() => props.data.specialFlag),
  {
    isTeleportable: 0,
    isIconCustomizable: 1,
    isCaveEntrance: 2,
  },
)

const iconStyleMeta = computed(() => {
  return ICON_STYLE_META_MAP.get(props.data.iconStyleType!)
})

const hiddenFlagType = computed(() => {
  const { hiddenFlag } = props.data
  if (hiddenFlag === undefined) return 'warning'
  return {
    [HiddenFlagEnum.SHOW]: 'success',
    [HiddenFlagEnum.BETA]: 'info',
    [HiddenFlagEnum.EASTER]: 'primary',
    [HiddenFlagEnum.HIDDEN]: 'danger',
  }[hiddenFlag] as TagProps['type']
})

const { humanFriendlyTimeText } = useRefreshTime(
  computed(() => props.data.defaultRefreshTime),
  {
    toHumanFriendly: (days, hours) => {
      return `${days} 天 ${hours} 小时`
    },
  },
)
</script>

<template>
  <div class="item-grid-card" @click="() => emits('review', props.data)">
    <div class="flex">
      <AppIconTagRenderer
        :src="iconStore.iconTextureUrl"
        :mapping="iconStore.iconCoordMap.get(props.data.iconId ?? -1)"
        :class="`type-${props.data.iconStyleType ?? IconStyle.DEFAULT}`"
        class="item-icon"
      >
        <img draggable="false" :src="UnknownIconUrl" />
      </AppIconTagRenderer>

      <div class="mx-3 h-12 flex-1 flex-col overflow-hidden" style="contain: layout">
        <div
          class="w-full mb-1 overflow-hidden whitespace-nowrap text-ellipsis font-[HYWenHei-85W]"
          :title="data.name"
        >
          {{ data.name }}
        </div>
        <div
          class="w-full overflow-hidden whitespace-nowrap text-ellipsis text-xs"
          :title="areaName"
        >
          {{ areaName }}
        </div>
      </div>

      <div>
        <el-button
          :icon="Delete"
          type="danger"
          size="small"
          plain
          style="padding: 6px 5px"
          @click.stop="() => emits('delete', props.data)"
        />
      </div>
    </div>

    <div class="mt-3 h-4 flex items-center text-xs">
      <div class="inline-sperator" :title="iconStyleMeta?.description">
        {{ iconStyleMeta?.name ?? '未知图标类型' }}
      </div>
      <div class="inline-sperator">
        <el-tag :type="hiddenFlagType" size="small" disable-transitions>
          {{ HIDDEN_FLAG_NAME_MAP[props.data.hiddenFlag!] ?? '未知显示类型' }}
        </el-tag>
      </div>
      <div class="inline-sperator">
        {{ humanFriendlyTimeText }}
      </div>
    </div>

    <div class="flex gap-1">
      <el-tag v-if="isTeleportable" size="small" type="info" class="mt-2" disable-transitions>
        可传送
      </el-tag>
      <el-tag v-if="isIconCustomizable" size="small" type="info" class="mt-2" disable-transitions>
        自定义图标
      </el-tag>
      <el-tag v-if="isCaveEntrance" size="small" type="info" class="mt-2" disable-transitions>
        洞口
      </el-tag>
    </div>

    <el-divider style="margin: 8px 0" />

    <div class="flex justify-between text-xs">
      <div class="flex-1 shrink-0 flex items-center gap-2">
        <div>点位数量</div>
        <el-text type="primary" size="small">
          {{ props.count ?? 0 }}
        </el-text>
      </div>

      <div class="flex-1 shrink-0 flex items-center gap-2">
        <div>排序权重</div>
        <el-text type="primary" size="small">
          {{ props.data.sortIndex ?? '未设置' }}
        </el-text>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-grid-card {
  flex-shrink: 0;
  width: 260px;
  padding: 10px 10px 8px;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: all ease 100ms;

  &:hover {
    filter: drop-shadow(0 0 4px var(--el-color-primary));
  }
  &:active {
    filter: drop-shadow(0 0 1px var(--el-color-primary));
    border-color: var(--el-color-primary);
  }
}

.item-icon {
  --icon-border: var(--el-color-info-light-9);
  --icon-bg: var(--el-color-info-light-3);

  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--icon-bg);
  border: 4px solid var(--icon-border);
  outline: 1px solid var(--icon-bg);
  overflow: hidden;

  /** 无边框 */
  &.type-1 {
    --icon-bg: transparent;
    --icon-border: transparent;
  }

  /** 类神瞳 */
  &.type-2 {
    --icon-bg: transparent;
    --icon-border: transparent;
  }

  /** 类神瞳无对钩 */
  &.type-3 {
    --icon-bg: transparent;
    --icon-border: transparent;
  }
}

.inline-sperator {
  display: flex;
  align-items: center;
  &:not(:last-of-type)::after {
    content: '';
    display: inline-block;
    line-height: 16px;
    height: 12px;
    width: 1px;
    background-color: var(--el-border-color);
    margin: 0 10px;
  }
}
</style>
