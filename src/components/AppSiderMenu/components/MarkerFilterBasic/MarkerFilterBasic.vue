<script lang="ts" setup>
import type { AreaVo, ItemTypeVo, ItemVo } from '@/api/alova/globals'
import { DeleteFilled } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { AppIconTagRenderer, GSButton } from '@/components'
import { fallbackToStaticIcon } from '@/configs'
import {
  useArchiveStore,
  useAreaStore,
  useIconStore,
  useItemStore,
  useItemTypeStore,
  useMapStateStore,
  useMarkerStore,
  usePreferenceStore,
} from '@/stores'
import { CheckboxGroup, ConditionRow, ItemButton } from '.'
import { DefaultMarkingItem, FilterTabPanel, FilterTabs } from './components'
import { useItemCount, useMarkerFilter, useTypeCount } from './hooks'

const archiveStore = useArchiveStore()
const iconStore = useIconStore()
const preferenceStore = usePreferenceStore()
const { areaIdMap, areaCodeMap, parentAreaList, childrenAreaList } = storeToRefs(useAreaStore())
const { itemList, itemIdMap } = storeToRefs(useItemStore())
const { itemTypeList, itemTypeIdMap } = storeToRefs(useItemTypeStore())
const { markerBasicFilters } = storeToRefs(useMapStateStore())
const { markerList } = storeToRefs(useMarkerStore())

// ==================== 其他 ====================
/** 筛选预设管理器 */
const { reviewCondition, deleteCondition, clearCondition } = useMarkerFilter()

const autoNextTab = () => {
  if (!preferenceStore.autoNext) return
  preferenceStore.step += 1
}

const archivedMarkers = computed(() => {
  const set = archiveStore.currentArchive.body.Data_KYJG
  return markerList.value.filter(marker => set.has(marker.id!))
})

// ==================== 地区 ====================
const selectedParentArea = computed(() => {
  if (!preferenceStore.parentAreaCode) return
  return areaCodeMap.value.get(preferenceStore.parentAreaCode)
})

const selectedChildrenAreaList = computed<AreaVo[]>(() => {
  if (!selectedParentArea.value) return []
  return childrenAreaList.value.filter(({ parentId }) => parentId === selectedParentArea.value?.id)
})

const selectedArea = computed(() => areaCodeMap.value.get(preferenceStore.areaCode))

// ==================== 分类 ====================
const accessItemTypeList = computed<ItemTypeVo[]>(() =>
  itemTypeList.value.filter(type => Boolean(type.isFinal)),
)

const selectedType = computed(() => {
  return itemTypeIdMap.value.get(preferenceStore.itemTypeId)
})

// ==================== 物品 ====================

/** 当前地区可用的全部物品 */
const accessItemList = computed(() => {
  const area = selectedArea.value
  if (!area) return []
  return [...itemList.value].filter(item => item.areaId === area.id)
})

/** 当前分类可用的全部物品 */
const visibleItemList = computed<ItemVo[]>(() => {
  const type = selectedType.value
  if (!type) return []
  return accessItemList.value.filter(({ typeIdList = [] }) => new Set(typeIdList).has(type.id!))
})

/** 当前分类可用的全部物品 id */
const visibleItemIds = computed(() => {
  const set = new Set<number>()
  accessItemList.value.forEach(({ id }) => {
    set.add(id!)
  })
  return set
})

/** 该项用于精细显示在当前分类下已选的物品数 */
const selectedItemCount = computed(() => {
  if (!preferenceStore.itemIds.length) return 0
  const currentTypeItemIds = new Set(visibleItemList.value.map(item => item.id!))
  return preferenceStore.itemIds.reduce((sum, cur) => {
    if (currentTypeItemIds.has(cur)) sum += 1
    return sum
  }, 0)
})

// ==================== 分类计数 ====================

const { typeTotalMap, typeCountMap } = useTypeCount({
  archivedMarkers,
  itemIdMap,
  itemTypeIdMap,
  markerList,
  visibleItemIds,
})

// ==================== 物品计数 ====================

const { itemTotalMap, itemCountMap } = useItemCount({
  archivedMarkers,
  markerList,
})
</script>

<template>
  <FilterTabs
    v-model="preferenceStore.step"
    class="flex-1"
    style="min-height: 350px; max-height: 500px"
  >
    <FilterTabPanel label="地区" :content="selectedArea?.name ?? '--'" :value="0">
      <div class="h-full grid grid-cols-[1fr_auto_1fr]">
        <CheckboxGroup
          v-model="preferenceStore.parentAreaCode"
          :options="parentAreaList"
          label-key="name"
          value-key="code"
        >
          <template #icon="{ row }">
            <AppIconTagRenderer
              :src="iconStore.iconTextureUrl"
              :mapping="
                iconStore.iconCoordMap.get(
                  row.iconId ?? areaIdMap.get(row.parentId ?? -1)?.iconId ?? -1,
                )
              "
              class="w-full aspect-square"
            >
              <img :src="fallbackToStaticIcon(row)" />
            </AppIconTagRenderer>
          </template>
        </CheckboxGroup>

        <div style="width: 1px; height: 100%; background: #e3ddd140" />

        <CheckboxGroup
          v-model="preferenceStore.areaCode"
          :options="selectedChildrenAreaList"
          label-key="name"
          value-key="code"
          @change="autoNextTab"
        >
          <template #icon="{ row }">
            <AppIconTagRenderer
              :src="iconStore.iconTextureUrl"
              :data-icon-id="row.iconId"
              :data-parent-icon-id="areaIdMap.get(row.parentId ?? -1)?.iconId"
              :mapping="
                iconStore.iconCoordMap.get(row.iconId!)
                ?? iconStore.iconCoordMap.get(areaIdMap.get(row.parentId ?? -1)?.iconId!)
              "
              class="w-full aspect-square"
            >
              <img
                :src="
                  fallbackToStaticIcon(row)
                  || fallbackToStaticIcon(areaIdMap.get(row.parentId ?? -1))
                "
              />
            </AppIconTagRenderer>
          </template>
        </CheckboxGroup>
      </div>
    </FilterTabPanel>

    <FilterTabPanel label="类型" :content="selectedType?.name ?? '--'" :value="1">
      <CheckboxGroup
        v-model="preferenceStore.itemTypeId"
        :options="accessItemTypeList"
        label-key="name"
        value-key="id"
        two-col
        @change="autoNextTab"
      >
        <template #icon="{ row }">
          <AppIconTagRenderer
            :src="iconStore.iconTextureUrl"
            :mapping="iconStore.iconCoordMap.get(row.iconId ?? -1)"
            class="w-full aspect-square"
          />
        </template>
        <template #default="{ row, actived }">
          <ItemButton
            :finished-num="typeCountMap.get(row.id!)"
            :total-num="typeTotalMap.get(row.id!)"
            :name="row.name"
            :actived="actived"
          />
        </template>
      </CheckboxGroup>
    </FilterTabPanel>

    <FilterTabPanel
      label="物品"
      :content="selectedType ? `已选 ${selectedItemCount} 项` : '--'"
      :value="2"
    >
      <CheckboxGroup
        v-model:multiple-value="preferenceStore.itemIds"
        :options="visibleItemList"
        label-key="name"
        value-key="id"
        multiple
        show-select-all-btn
        two-col
        draggable
      >
        <template #icon="{ row }">
          <AppIconTagRenderer
            :src="iconStore.iconTextureUrl"
            :mapping="iconStore.iconCoordMap.get(row.iconId ?? -1)"
            class="w-full aspect-square"
          />
        </template>
        <template #all="{ actived }">
          <ItemButton
            :finished-num="selectedType ? typeCountMap.get(selectedType.id!) : 0"
            :total-num="selectedType ? typeTotalMap.get(selectedType.id!) : 0"
            name="选择全部"
            :actived="actived"
          />
        </template>
        <template #default="{ row, actived }">
          <ItemButton
            :finished-num="itemCountMap.get(row.id!)"
            :total-num="itemTotalMap.get(row.id!)"
            :name="row.name"
            :actived="actived"
          />
        </template>
      </CheckboxGroup>
    </FilterTabPanel>
  </FilterTabs>

  <div class="text-white px-2 pt-1">默认打点物品</div>

  <DefaultMarkingItem
    v-model:item-id="preferenceStore.defaultMarkingItemId"
    :item-count-map="itemCountMap"
    :item-total-map="itemTotalMap"
  />

  <div class="flex-shrink-0 flex items-center gap-2 text-white px-2 pt-1">
    条件列表
    <el-tooltip
      placement="top-start"
      effect="light"
      content="部分物品可能从属于多个分类，从而对应多个条件。"
    >
      <el-icon :size="16">
        <QuestionFilled />
      </el-icon>
    </el-tooltip>
  </div>

  <div class="flex-shrink-0 flex-1 pt-2 pb-0 overflow-hidden">
    <el-scrollbar class="px-2" height="100%">
      <div class="h-full flex flex-col gap-2">
        <ConditionRow
          v-for="[id, condition] in markerBasicFilters"
          :key="id"
          :condition="condition"
          @review="() => reviewCondition(id)"
          @delete="() => deleteCondition(id)"
        />
      </div>
    </el-scrollbar>
  </div>

  <div class="condition-add-btn flex gap-2 justify-center p-2">
    <slot name="prepend" />
    <GSButton
      class="flex-1"
      size="small"
      :disabled="!markerBasicFilters.size"
      @click="clearCondition"
    >
      <template #icon>
        <el-icon color="var(--gs-color-danger)">
          <DeleteFilled />
        </el-icon>
      </template>
      清空条件
    </GSButton>
    <slot name="append" />
  </div>
</template>
