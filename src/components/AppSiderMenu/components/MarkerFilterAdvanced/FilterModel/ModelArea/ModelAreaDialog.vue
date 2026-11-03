<script lang="ts" setup>
import type { AreaWithChildren } from '@/stores'
import type { MAFMetaArea } from '@/stores/types'
import { useListBubbleDrag } from '@/hooks'
import { SelectList } from '../../../SelectList'

const props = defineProps<{
  meta: MAFMetaArea
  listClass?: string
  list: AreaWithChildren[]
  labelKey: keyof AreaWithChildren
  valueKey: string
}>()

const modelValue = defineModel<number[]>('modelValue', {
  required: true,
  default: [],
})

const childrenList = ref<AreaWithChildren[]>([])

/* --------------------------------------------------
 * 计数相关数据
 * --------------------------------------------------
 */
const childrenCountMap = computed(() => {
  const childrenCount: Record<number, number> = {}
  modelValue.value.forEach(areaId => {
    const parentId = props.meta.areaParentIdMap[areaId] ?? -1
    childrenCount[parentId] = (childrenCount[parentId] ?? 0) + 1
  })
  return childrenCount
})

/* --------------------------------------------------
 * 拖拽计数清除分组逻辑
 * --------------------------------------------------
 */
const removeChildren = (parent: AreaWithChildren) => {
  const shallowCopyValue = [...modelValue.value]
  const valueSet = new Set<number>(shallowCopyValue)
  const childrenIds: number[] = (parent.children ?? []).map(child => child.id!).filter(v => v)
  childrenIds.forEach(childId => {
    valueSet.delete(childId)
  })
  modelValue.value = Array.from(valueSet)
}

const { onDragStart, onDragEnd, onDrop } = useListBubbleDrag<AreaWithChildren>({
  isDropback: (ev, item) =>
    Boolean(
      ev
        .composedPath()
        .find(
          target => target instanceof HTMLElement && Number(target.dataset.dragId) === item.id!,
        ),
    ),
  onClearBubble: removeChildren,
})
</script>

<template>
  <div class="w-full flex-1 flex gap-2 overflow-hidden">
    <el-scrollbar class="flex-1">
      <SelectList
        v-model="childrenList"
        class="h-full overflow-auto gap-1"
        :list="list"
        value-key="children"
        @dragover.prevent
        @dragend="onDragEnd"
        @drop="onDrop"
      >
        <template #default="{ item }">
          <div class="flex-auto flex items-center" :data-drag-id="item.id">
            <span class="flex-auto">{{ item[labelKey] }}</span>
            <el-button
              v-if="childrenCountMap[item.id!] > 0"
              class="flex-none"
              type="primary"
              size="small"
              round
              .draggable="true"
              @dragstart.stop="(ev: DragEvent) => onDragStart(ev, item)"
            >
              {{ childrenCountMap[item.id!] }}
            </el-button>
          </div>
        </template>
      </SelectList>
    </el-scrollbar>
    <div class="w-[2px] h-[97%] translate-y-[1.5%] bg-[#E3DDD140]" />
    <el-scrollbar class="flex-1">
      <SelectList
        v-model="modelValue"
        :multiple="true"
        class="h-full overflow-auto gap-1"
        :list="childrenList"
        :value-key="valueKey"
      >
        <template #default="{ item }">
          {{ item[labelKey] }}
        </template>
      </SelectList>
    </el-scrollbar>
  </div>
</template>
