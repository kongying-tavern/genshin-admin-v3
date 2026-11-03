<script lang="ts" setup>
import { DeleteFilled, MapLocation, Plus, QuestionFilled } from '@element-plus/icons-vue'
import { GSButton } from '@/components'
import { useMapStateStore } from '@/stores'
import { MapTilePicker, ModelComponent, ModelGroup, ModelPicker, SemanticText } from '.'
import { FilterModel } from './FilterModel'

const mapStateStore = useMapStateStore()

/** 筛选预设管理器 */
const {
  copyMAFCache,
  clearMAFCache,
  appendMAFGroup,
  toggleMAFItemOperator,
  toggleMAFItemOpposite,
  appendMAFItem,
  deleteMAFItem,
} = mapStateStore

// ------------------------------------------------
// 地区底图选择器相关
// ------------------------------------------------
const mapTilePickerVisible = ref(false)

const openMapTilePicker = () => {
  mapTilePickerVisible.value = true
}

// ------------------------------------------------
// 模型选择器相关
// ------------------------------------------------
const modelPickerVisible = ref(false)

const modelPickerGroupIndex = ref(-1)

const openPicker = (groupIndex: number) => {
  modelPickerGroupIndex.value = groupIndex
  modelPickerVisible.value = true
}

const handleModelPickerSelected = (id: number) => {
  if (!Number.isFinite(modelPickerGroupIndex.value) || modelPickerGroupIndex.value <= -1) return

  appendMAFItem(modelPickerGroupIndex.value, id)
  modelPickerGroupIndex.value = -1
}
</script>

<template>
  <div class="flex-none flex items-center gap-2 text-white px-2 pb-1 pt-2">
    <!-- 条件列表 -->
    <div class="flex-auto flex gap-1 items-center">
      条件列表
      <el-tooltip
        placement="top-start"
        effect="light"
        content="筛选条件不会即时生效，点击【应用】按钮应用当前筛选条件。"
      >
        <el-icon :size="16">
          <QuestionFilled />
        </el-icon>
      </el-tooltip>
    </div>
    <div class="flex-none flex gap-1">
      <GSButton size="small" @click="openMapTilePicker()">
        <template #icon>
          <el-icon color="var(--gs-color-success)">
            <MapLocation />
          </el-icon>
        </template>
        地图
      </GSButton>
      <GSButton
        icon="submit"
        size="small"
        :disabled="mapStateStore.markerAdvancedSame"
        @click="copyMAFCache()"
      >
        应用
      </GSButton>
      <GSButton size="small" @click="appendMAFGroup()">
        <template #icon>
          <el-icon color="var(--gs-color-cancel)">
            <Plus />
          </el-icon>
        </template>
        新增组
      </GSButton>
    </div>
  </div>
  <div class="flex-3 py-1 overflow-hidden">
    <el-scrollbar class="px-2" height="100%">
      <ModelGroup
        v-model="mapStateStore.markerAdvancedComposed"
        @append-item="groupIndex => openPicker(groupIndex)"
      >
        <template
          #default="{
            groupIndex,
            item,
            itemIndex,
            isFirstItem,
            isLastItem,
            isItemGrabbing,
            isItemDragging,
          }"
        >
          <ModelComponent
            class="sort-item"
            :class="{
              'is-grabbing': isItemGrabbing,
              'is-dragging': isItemDragging,
            }"
            :composed-condition="item"
            :is-first="isFirstItem"
            :is-last="isLastItem"
            :with-move-up="false"
            :with-move-down="false"
            @switch-operator="() => toggleMAFItemOperator(groupIndex, itemIndex)"
            @toggle-opposite="() => toggleMAFItemOpposite(groupIndex, itemIndex)"
            @delete-item="() => deleteMAFItem(groupIndex, itemIndex)"
          >
            <FilterModel v-model="item.value" :composed-condition="item" />
          </ModelComponent>
        </template>
      </ModelGroup>
    </el-scrollbar>
  </div>

  <!-- 条件语义化 -->
  <div class="flex-none px-2 py-1 text-white">条件语义化</div>
  <div class="py-1 max-h-60">
    <el-scrollbar class="px-2" height="100%">
      <SemanticText />
    </el-scrollbar>
  </div>

  <!-- 底部功能区 -->
  <div class="condition-add-btn flex gap-2 justify-center p-2">
    <slot name="prepend" />
    <GSButton
      class="flex-1"
      size="small"
      :disabled="!mapStateStore.markerAdvancedFilters.length"
      @click="clearMAFCache"
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

  <MapTilePicker v-model="mapTilePickerVisible" />
  <ModelPicker v-model="modelPickerVisible" @select="handleModelPickerSelected" />
</template>
