<script lang="ts" setup>
import type { AreaVo } from '@/api/alova/globals'
import { AppIconTagRenderer, GSSwitch } from '@/components'
import { fallbackToStaticIcon } from '@/configs'
import {
  useArchiveStore,
  useAreaStore,
  useIconStore,
  useItemStore,
  useMarkerStore,
  usePreferenceStore,
} from '@/stores'

const archiveStore = useArchiveStore()
const iconStore = useIconStore()
const areaStore = useAreaStore()
const itemStore = useItemStore()
const markerStore = useMarkerStore()
const preferenceStore = usePreferenceStore()

/** 是否显示限定地区数据 */
const showRestrictedArea = computed({
  get: () => archiveStore.currentArchive.body.Preference['userCenter.setting.showRestrictedArea'],
  set: v => {
    archiveStore.currentArchive.body.Preference['userCenter.setting.showRestrictedArea'] = v
  },
})

/**
 * 属于限定的地区
 * @todo 从硬编码改为从订阅数据拉取
 */
const RESTRICTED_AREA_CODES = shallowRef(
  new Set(['C:APPLE', 'C:APPLE', 'C:DQ:SANJIE', 'C:VELURIYAM', 'C:SIMULANKA']),
)

/** 物品对应的国级地区 id 表 */
const itemAreaIdMap = computed(() => {
  return itemStore.itemList.reduce((map, { id: itemId = -1, areaId = -1 }) => {
    const area = areaStore.areaIdMap.get(areaId)
    if (!area) {
      return map.set(itemId, {
        name: `未知地区(${areaId})`,
        code: `UNKNOWN:${areaId}`,
        id: areaId,
      })
    }

    if (!area.isFinal) return map.set(itemId, area)

    const parentArea = areaStore.areaIdMap.get(area.parentId!)
    if (!parentArea) {
      return map.set(itemId, {
        name: `未知父地区 (${area.parentId})`,
        code: `UNKNOWN:${area.parentId}`,
        id: area.parentId,
      })
    }

    map.set(itemId, parentArea)

    return map
  }, new Map<number, AreaVo>())
})

/** 为每个宝箱点位匹配其地区数据 */
const countMap = computed(() => {
  const areaMap = areaStore.areaList.reduce((map, area) => {
    if (!area.isFinal) map.set(area.id!, { area, count: 0, total: 0 })
    return map
  }, new Map<number, { area: AreaVo; count: number; total: number }>())

  return markerStore.markerList.reduce((map, { id: markerId = -1, itemList = [] }) => {
    itemList.forEach(({ itemId = -1 }) => {
      const area = itemAreaIdMap.value.get(itemId)!
      if (!area) return
      if (!map.has(area.id!)) map.set(area.id!, { area, count: 0, total: 0 })
      const object = map.get(area.id!)!
      object.total += 1
      if (archiveStore.currentArchive.body.Data_KYJG.has(markerId)) object.count += 1
    })
    return map
  }, areaMap)
})
</script>

<template>
  <div class="w-full flex-1 flex flex-col overflow-hidden">
    <div
      class="flex-shink-0 w-full px-4 flex justify-between items-center text-lg p-2"
      style="color: #84603d"
    >
      <div
        v-if="archiveStore.currentArchive.slotIndex < 0"
        class="w-72 flex-shrink-0 overflow-hidden text-ellipsis whitespace-nowrap"
      >
        {{ '<未选取存档>' }}
      </div>
      <div
        v-else
        class="w-72 flex-shrink-0 overflow-hidden text-ellipsis whitespace-nowrap"
        :title="archiveStore.archiveSlots[archiveStore.currentArchive.slotIndex]?.name"
      >
        宝箱收集进度({{ archiveStore.archiveSlots[archiveStore.currentArchive.slotIndex]?.name }})
      </div>

      <div class="flex-1 flex justify-end">
        <GSSwitch
          v-model="showRestrictedArea"
          label="包含限定地区"
          label-position="left"
          label-inactive-color="#353D4F"
        />
      </div>
    </div>

    <div class="flex-1 pb-6 overflow-hidden">
      <el-scrollbar>
        <div class="gs-archive-analyser-container grid grid-cols-2 grid-rows-4 px-3">
          <div
            v-for="[areaId, { area, count, total }] in countMap"
            v-show="preferenceStore.showRestrictedArea || !RESTRICTED_AREA_CODES.has(area.code!)"
            :key="areaId"
            class="gs-archive-analyser-item"
            :style="{
              '--markers-ratio': `${(count / total || 0).toFixed(2)}%`,
            }"
          >
            <AppIconTagRenderer
              class="w-12 h-12 row-span-2 rounded-sm"
              :style="{
                '--theme-color': '#84603D',
              }"
              :src="iconStore.iconTextureUrl"
              :mapping="iconStore.iconCoordMap.get(area.iconId ?? -1)"
              mask="var(--theme-color)"
            >
              <div
                class="gs-archive-area w-full h-full row-span-2 rounded-sm"
                :style="{ '--icon': `url(${fallbackToStaticIcon(area)})` }"
              />
            </AppIconTagRenderer>

            <div
              class="text-base overflow-hidden whitespace-nowrap text-ellipsis"
              :title="area.name"
            >
              {{ area.name }}
            </div>

            <div class="text-xs text-right whitespace-nowrap">{{ count }} / {{ total }}</div>

            <div class="gs-archive-analyser-bar col-span-2 flex items-center justify-end text-xs">
              {{ ((100 * count) / total || 0).toFixed(2) }} %
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<style scoped>
@property --percentage {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

.gs-archive-analyser-item {
  --percentage: 0%;
  --radius: 8px;
  --clip: inset(0 0% 0 0);
  --shadow-color: #cccccc80;

  display: grid;
  gap: 0 4px;
  align-items: center;
  grid-template-columns: auto 1fr 1fr;
  padding: 2px 4px 2px 2px;
  margin: 4px;
  border-radius: 6px;
  border: 2px solid #e0d6cb;
  outline: 2px solid transparent;
  position: relative;
  background: #f0e9dc;
  justify-content: space-between;
  overflow: hidden;
  user-select: none;
  box-shadow: 0 0 4px var(--shadow-color);
  cursor: pointer;
  transition:
    all ease 150ms,
    border-color linear 100ms,
    outline-color linear 100ms;

  &:hover {
    --shadow-color: #aaaaaa80;
    background: #f4eee1;
    border-color: transparent;
    outline-color: #d7cbbc;
  }
}

.gs-archive-area {
  background: var(--theme-color);
  mask: var(--icon);
  mask-size: contain;
}

.gs-archive-analyser-bar {
  --percentage: var(--markers-ratio);

  height: 16px;
  padding: 0 2px;
  background: linear-gradient(to right, #f7ba3f var(--percentage), #e0dcd4 var(--percentage));
  border-radius: 2px;
  transition: --percentage ease 500ms;
  transition-delay: var(--anime-delay);
  position: relative;

  &::before {
    content: var(--percentage);
    color: red;
    border: 1px solid red;
    width: 40px;
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
  }
}
</style>
