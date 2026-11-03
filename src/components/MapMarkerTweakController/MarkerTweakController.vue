<script setup lang="ts">
import type { CascaderValue } from 'element-plus'
import { ArrowDown, Check, CirclePlus, Close } from '@element-plus/icons-vue'
import { ElCascaderPanel, ElDropdown, ElIcon } from 'element-plus'
import { AppIconTagRenderer, AppVirtualTable, AppWindowTeleporter } from '@/components'
import { useIconStore, useItemStore } from '@/stores'
import { pickMainItem } from '@/utils'
import { MapMissionInfo } from '../MapMissionInfo'
import { ModifierCard, ModifierPreview } from './components'
import { useMarkerTweaks, useMultiSelect, useTweaks } from './hooks'
import { IconMouse } from './icons'

const itemStore = useItemStore()
const iconStore = useIconStore()

const { windowInfo, shape, markerList, width, height, isMatched, closeWindow, onFinalize } =
  useMultiSelect()

const {
  tweakList,
  tweakData,
  tweakOptions,
  modifiedMarkerList,
  selectedIndex,
  selectedModifier,
  selectedMeta,
  createTweak: _createTweak,
  deleteTweak,
  clearTweaks,
} = useTweaks(markerList)

const { submit, isDisabled, loading } = useMarkerTweaks({
  markerList,
  tweakList,
  tweakData,
})

/** @todo 基于 el 组件行为实现，不是很优雅，后期使用独立组件 */
const drownRef = ref<InstanceType<typeof ElDropdown>>()
const cascaderPanelRef = ref<InstanceType<typeof ElCascaderPanel>>()

const createTweak = (value?: CascaderValue | null) => {
  if (!value) {
    console.error()
    return
  }
  if (!Array.isArray(value)) return
  _createTweak(value as string[])
  drownRef.value?.handleClose()
  cascaderPanelRef.value?.clearCheckedNodes()
}

onFinalize(() => {
  clearTweaks()
})
</script>

<template>
  <div class="w-full h-full absolute left-0 top-0 pointer-events-none z-[1]">
    <svg v-if="shape" :viewBox="`0 0 ${width} ${height}`" fill="transparent">
      <rect
        :x="shape.xmin"
        :y="shape.ymin"
        :width="shape.width"
        :height="shape.height"
        stroke="yellow"
        stroke-width="2"
      />
    </svg>

    <MapMissionInfo v-if="isMatched" title="多选点位">
      <div class="flex items-center mb-1">
        - 按住 <span class="keyboard-key">Ctrl</span> +
        <IconMouse class="w-5 h-5" left /> 选择点位<br />
      </div>
      <div class="flex items-center">
        - 按住 <span class="keyboard-key">Ctrl</span> +
        <IconMouse class="w-5 h-5" right /> 取消选择点位。
      </div>
    </MapMissionInfo>

    <AppWindowTeleporter :info="windowInfo">
      <div class="h-full flex overflow-hidden p-2">
        <div class="h-full w-[300px] flex flex-col pr-2">
          <div class="pb-2">
            <ElDropdown ref="drownRef" placement="bottom-start" trigger="click" :teleported="false">
              <el-button :icon="CirclePlus">
                添加编辑操作
                <ElIcon class="el-icon--right" :size="12">
                  <ArrowDown />
                </ElIcon>
              </el-button>
              <template #dropdown>
                <ElCascaderPanel
                  ref="cascaderPanelRef"
                  :options="tweakOptions"
                  @change="createTweak"
                />
              </template>
            </ElDropdown>
          </div>

          <div class="flex-1 flex-shrink-0 flex flex-col gap-2 overflow-auto">
            <div v-for="(tweak, index) in tweakList" :key="tweak.id">
              <ModifierCard
                v-model:selected-index="selectedIndex"
                :modifier="tweak.modifier"
                :index="index"
                :model-value="tweakData.get(tweak.id)!"
                @update:model-value="value => tweakData.set(tweak.id, value)"
                @remove="() => deleteTweak(index)"
              />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <el-button
              :loading="loading"
              :disabled="isDisabled"
              :icon="Check"
              type="primary"
              @click="submit"
            >
              应用
            </el-button>
            <el-button :icon="Close" @click="closeWindow"> 取消 </el-button>
          </div>
        </div>

        <div
          class="flex-1 h-full flex flex-col overflow-hidden rounded bg-[var(--el-fill-color-light)]"
        >
          <div
            class="flex h-8 items-center text-xs ml-2 mr-3 border-b-[1px] border-[var(--el-border-color)]"
          >
            <div class="w-16 mx-2 ml-4 text-center">点位</div>
            <el-divider direction="vertical" style="height: 100%" />
            <div v-if="!selectedModifier" class="flex-1 text-center">请添加编辑操作</div>
            <template v-else>
              <div class="flex-1">
                {{ selectedModifier.options.label }}
              </div>
              <el-divider direction="vertical" style="height: 100%" />
              <div class="flex-1">
                {{ selectedModifier.options.replaceLabel }}
              </div>
            </template>
          </div>

          <AppVirtualTable
            :data="modifiedMarkerList"
            :item-height="selectedModifier?.options.previewHeight ?? 32"
            :cached-rows="1"
            class="flex-1 overflow-hidden"
          >
            <template #default="{ item: { oldData, newData }, index }">
              <div
                class="h-full overflow-hidden text-sm flex items-center border-[var(--el-border-color)] ml-2 mr-3 bg-clip-content"
                :class="index < modifiedMarkerList.length - 1 ? 'border-b-[1px]' : ''"
              >
                <div class="w-10 text-xs text-right">
                  {{ newData.id }}
                </div>
                <div class="w-6 mx-2 ml-4">
                  <AppIconTagRenderer
                    :mapping="
                      iconStore.iconCoordMap.get(
                        pickMainItem(newData, itemStore.itemIdMap).mainIconId,
                      )
                    "
                    :src="iconStore.iconTextureUrl"
                    class="w-6 h-6"
                  />
                </div>
                <el-divider direction="vertical" style="height: 100%" />
                <div
                  v-if="!selectedModifier"
                  class="flex-1 text-center text-xs text-[var(--el-text-color-secondary)]"
                >
                  no action
                </div>
                <template v-else>
                  <div class="h-full flex-1 overflow-hidden">
                    <ModifierPreview
                      :modifier="selectedModifier"
                      :data="oldData"
                      :meta="selectedMeta!"
                    />
                  </div>
                  <el-divider direction="vertical" style="height: 100%" />
                  <div class="h-full flex-1 overflow-hidden">
                    <ModifierPreview
                      :modifier="selectedModifier"
                      :data="newData"
                      :old-data="oldData"
                      :meta="selectedMeta!"
                    />
                  </div>
                </template>
              </div>
            </template>
          </AppVirtualTable>
        </div>
      </div>
    </AppWindowTeleporter>
  </div>
</template>

<style scoped>
.keyboard-key {
  @apply inline-block p-px px-1 mx-1
    border border-[#C6C2BA] rounded
    text-xs;
}
</style>
