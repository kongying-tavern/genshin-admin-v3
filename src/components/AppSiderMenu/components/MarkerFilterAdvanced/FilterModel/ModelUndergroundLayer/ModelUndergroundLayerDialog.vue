<script lang="ts" setup>
import type { AreaWithExtraConfig } from '@/stores'
import type { MAFMetaUndergroundLayer } from '@/stores/types'
import { keyBy } from 'lodash'
import { IconLayersFilled } from '@/components/AppIcons'
import { useListBubbleDrag } from '@/hooks'
import { MarkerFilterButton } from '../../../MarkerFilterComponent'
import { SelectList } from '../../../SelectList'

const props = defineProps<{
  meta: MAFMetaUndergroundLayer
  listClass?: string
  list: AreaWithExtraConfig[]
  labelKey: keyof ConfigLayerUnit['children'][0]
  valueKey: string
}>()

const modelValue = defineModel<string[]>('modelValue', {
  required: true,
  default: [],
})

interface ConfigLayerUnit {
  label: string
  value: string
  children: {
    label: string
    value: string
  }[]
}

const areaCombinedMap = computed(() => keyBy(props.list, 'id'))

const selectedAreaId = ref<number>(0)

const selectedLayers = computed<ConfigLayerUnit[]>(() => {
  const selectedArea = areaCombinedMap.value[selectedAreaId.value] ?? {}
  const { extraConfig = {} } = selectedArea
  const { underground = {} } = extraConfig
  const { levels = [] } = underground
  return levels
})

/* --------------------------------------------------
 * 计数相关数据
 * --------------------------------------------------
 */
const layerCountMap = computed(() => {
  const countMap: Record<string | number, number> = {}
  modelValue.value.forEach(layerKey => {
    const layerKeyItem = props.meta.layerKeyMap[layerKey]
    if (!layerKeyItem) return
    layerKeyItem.forEach(keyItem => {
      const { areaId = 0, groupKey = '' } = keyItem
      if (!areaId || !groupKey) return
      countMap[areaId] = (countMap[areaId] ?? 0) + 1
      countMap[`${areaId}-${groupKey}`] = (countMap[`${areaId}-${groupKey}`] ?? 0) + 1
    })
  })
  return countMap
})

const layerTotalMap = computed(() => {
  const totalMap: Record<string | number, number> = {}
  props.list.forEach(item => {
    const { id: areaId = 0, extraConfig = {} } = item
    const { underground = {} } = extraConfig
    const { levels = [] } = underground
    levels.forEach(group => {
      totalMap[areaId] = (totalMap[areaId] ?? 0) + group.children.length
      totalMap[`${areaId}-${group.value}`] =
        (totalMap[`${areaId}-${group.value}`] ?? 0) + group.children.length
    })
  })

  return totalMap
})

const layerTotalMatch = computed(() => {
  const matchMap: Record<string | number, boolean> = {}
  for (const key in layerTotalMap.value) {
    const totalCount = layerTotalMap.value[key] ?? 0
    const selectedCount = layerCountMap.value[key] ?? 0
    matchMap[key] = selectedCount >= totalCount
  }
  return matchMap
})

/* --------------------------------------------------
 * 层级标签处理方案
 * --------------------------------------------------
 */
// 添加地区内层级
const addArea = (area: AreaWithExtraConfig) => {
  const shallowCopyValue = [...modelValue.value]
  const valueSet = new Set<string>(shallowCopyValue)
  ;(area.extraConfig?.underground?.levels ?? []).forEach(group => {
    group.children.forEach(layer => {
      layer.value && valueSet.add(layer.value!)
    })
  })
  modelValue.value = Array.from(valueSet)
}

// 移除地区内层级
const removeArea = (area: AreaWithExtraConfig) => {
  const shallowCopyValue = [...modelValue.value]
  const valueSet = new Set<string>(shallowCopyValue)
  ;(area.extraConfig?.underground?.levels ?? []).forEach(group => {
    group.children.forEach(layer => valueSet.delete(layer.value!))
  })
  modelValue.value = Array.from(valueSet)
}

// 添加/移除地区内层级
const toggleArea = (area: AreaWithExtraConfig) => {
  const key = area.id ?? 0
  const matchTotal = layerTotalMatch.value[key]
  matchTotal ? removeArea(area) : addArea(area)
}

// 添加分组内层级
const addGroup = (item: ConfigLayerUnit) => {
  const shallowCopyValue = [...modelValue.value]
  const valueSet = new Set<string>(shallowCopyValue)
  ;(item.children ?? []).forEach(layer => {
    layer.value && valueSet.add(layer.value)
  })
  modelValue.value = Array.from(valueSet)
}

// 移除分组内层级
const removeGroup = (item: ConfigLayerUnit) => {
  const shallowCopyValue = [...modelValue.value]
  const valueSet = new Set<string>(shallowCopyValue)
  ;(item.children ?? []).forEach(layer => {
    valueSet.delete(layer.value)
  })
  modelValue.value = Array.from(valueSet)
}

// 添加/移除分组内层级
const toggleGroup = (item: ConfigLayerUnit) => {
  const areaId = selectedAreaId.value
  const layerKey = item.value ?? ''
  const key = `${areaId}-${layerKey}`
  const matchTotal = layerTotalMatch.value[key]
  matchTotal ? removeGroup(item) : addGroup(item)
}

/* --------------------------------------------------
 * 拖拽计数清除分组逻辑
 * --------------------------------------------------
 */
const {
  onDragStart: onAreaDragStart,
  onDragEnd: onAreaDragEnd,
  onDrop: onAreaDrop,
} = useListBubbleDrag<AreaWithExtraConfig>({
  isDropback: (ev, item) =>
    Boolean(
      ev
        .composedPath()
        .find(
          target => target instanceof HTMLElement && Number(target.dataset.dragAreaId) === item.id!,
        ),
    ),
  onClearBubble: removeArea,
})

const {
  isDragging: isGroupDragging,
  onDragStart: onGroupDragStart,
  onDragEnd: onGroupDragEnd,
  onDrop: onGroupDrop,
} = useListBubbleDrag<ConfigLayerUnit>({
  isDropback: (ev, item) =>
    Boolean(
      ev
        .composedPath()
        .find(target => target instanceof HTMLElement && target.dataset.dragGroupId === item.value),
    ),
  onClearBubble: removeGroup,
})
</script>

<template>
  <div class="w-[700px] flex-1 flex gap-2 overflow-hidden" :class="listClass">
    <el-scrollbar class="flex-[10]">
      <SelectList
        v-model="selectedAreaId"
        class="h-full overflow-auto gap-1"
        :disabled="isGroupDragging"
        :list="list"
        value-key="id"
        @dragover.prevent
        @dragend="onAreaDragEnd"
        @drop="onAreaDrop"
      >
        <template #default="{ item }">
          <div class="flex-auto flex items-center" :data-drag-area-id="item.id">
            <span class="flex-none mr-1">
              <MarkerFilterButton
                :theme="layerTotalMatch[item.id!] ? 'light' : 'dark'"
                @click.stop="toggleArea(item)"
              >
                <template #icon>
                  <IconLayersFilled />
                </template>
              </MarkerFilterButton>
            </span>
            <span class="flex-auto">{{ item.name }}</span>
            <el-button
              v-if="layerCountMap[item.id!]"
              class="flex-none"
              :type="layerTotalMatch[item.id!] ? 'warning' : 'primary'"
              size="small"
              round
              .draggable="true"
              @dragstart.stop="(ev: DragEvent) => onAreaDragStart(ev, item)"
            >
              {{ layerCountMap[item.id!] }}
            </el-button>
          </div>
        </template>
      </SelectList>
    </el-scrollbar>
    <div class="w-[2px] h-[97%] translate-y-[1.5%] bg-[#E3DDD140]" />
    <el-scrollbar class="flex-[13]" @dragover.prevent @dragend="onGroupDragEnd" @drop="onGroupDrop">
      <template v-for="(layerGroup, layerGroupIndex) in selectedLayers" :key="layerGroupIndex">
        <div
          v-if="layerGroup.children && layerGroup.children.length > 0"
          :data-drag-group-id="layerGroup.value"
        >
          <div class="flex pt-2 pb-1 gap-2 items-end">
            <span
              class="flex-none text-base leading-loose select-none underline underline-offset-4"
              :class="
                layerTotalMatch[`${selectedAreaId}-${layerGroup.value}`]
                  ? ['decoration-solid', 'hover:decoration-dotted']
                  : ['decoration-dashed', 'hover:decoration-double']
              "
              @click.stop="toggleGroup(layerGroup)"
            >
              {{ layerGroup.label }}
            </span>
            <div class="flex-auto">
              <el-button
                v-if="layerCountMap[`${selectedAreaId}-${layerGroup.value}`]"
                class="mb-[8px]"
                :type="
                  layerTotalMatch[`${selectedAreaId}-${layerGroup.value}`] ? 'warning' : 'primary'
                "
                size="small"
                round
                .draggable="true"
                @dragstart="(ev: DragEvent) => onGroupDragStart(ev, layerGroup)"
              >
                {{ layerCountMap[`${selectedAreaId}-${layerGroup.value}`] }}
              </el-button>
            </div>
          </div>
          <SelectList
            v-model="modelValue"
            :multiple="true"
            class="h-full overflow-auto gap-1"
            :list="layerGroup.children"
            :value-key="valueKey"
          >
            <template #default="{ item }">
              {{ item[labelKey] }}
            </template>
          </SelectList>
        </div>
      </template>
    </el-scrollbar>
  </div>
</template>
