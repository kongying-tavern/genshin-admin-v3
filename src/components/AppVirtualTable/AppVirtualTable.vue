<script setup lang="ts" generic="T">
import type { StyleValue } from 'vue'

/**
 * @todo 当前实现只支持固定尺寸项
 * @todo grid 模式下效果不是很好，需要优化
 */
const props = withDefaults(
  defineProps<{
    data: T[]
    itemHeight?: number
    itemWidth?: number
    itemGap?: [number, number]
    itemClass?: string | string[] | Record<string, boolean>
    cachedRows?: number
    alwaysScrollbar?: boolean
    scrollbarStyle?: StyleValue
  }>(),
  {
    data: () => [],
    itemHeight: 32,
    itemWidth: 0,
    itemGap: () => [0, 0],
    cachedRows: 1,
  },
)

const tableRef = ref<HTMLElement>()

const { width, height } = useElementSize(tableRef)

const scrollHeight = ref(0)
const handleScroll = ({ scrollTop }: { scrollTop: number; scrollLeft: number }) => {
  scrollHeight.value = scrollTop
}

const gridColumns = computed(() => {
  if (props.itemWidth <= 0) return 0
  const [gapWidth] = props.itemGap
  return Math.floor((width.value + gapWidth) / (props.itemWidth + gapWidth))
})

const virtualRows = computed(() => {
  const [_, gapHeight] = props.itemGap
  return Math.ceil((height.value + gapHeight) / (props.itemHeight + gapHeight)) + props.cachedRows
})

const virtualHeight = computed(() => {
  return (props.itemHeight + props.itemGap[1]) * virtualRows.value
})

const realHeight = computed(() => {
  if (gridColumns.value <= 0) return props.data.length * props.itemHeight
  return (
    Math.ceil(props.data.length / gridColumns.value) * (props.itemHeight + props.itemGap[1])
    - props.itemGap[1]
  )
})

const rowIndexList = computed(() => {
  const indexList: number[] = []
  for (let row = 1; row <= virtualRows.value; row++)
    indexList[row] =
      row
      + Math.ceil(Math.max(0, scrollHeight.value - row * props.itemHeight) / virtualHeight.value)
        * virtualRows.value
      - 1
  return indexList
})

const offsetMap = computed(() => {
  const map: Record<string, number> = {}
  for (let row = 1; row <= virtualRows.value; row++) {
    map[`--t${row}`] = Math.ceil(
      Math.max(0, scrollHeight.value - row * props.itemHeight) / virtualHeight.value,
    )
  }
  return map
})

const style = computed<Record<string, number>>(() => ({
  // virtual height
  '--vh': virtualHeight.value,
  // real height
  '--rh': realHeight.value,
  // grid
  '--cols': gridColumns.value,
  '--rows': virtualRows.value,
  // item
  '--iw': props.itemHeight,
  '--ih': props.itemWidth,
  // gap
  '--gx': props.itemGap[0],
  '--gy': props.itemGap[1],
  ...offsetMap.value,
}))
</script>

<template>
  <div ref="tableRef" class="app-virtual-table" :style="style">
    <el-scrollbar :always="alwaysScrollbar" :style="scrollbarStyle" @scroll="handleScroll">
      <div v-if="gridColumns > 0" class="virtual-scroll-wrapper is-grid">
        <template v-for="rowIndex in virtualRows">
          <div
            v-for="colIndex in gridColumns"
            :key="rowIndex * gridColumns + colIndex"
            :style="{
              '--offset': `var(--t${rowIndex})`,
            }"
            :class="itemClass"
            class="virtual-item"
          >
            <template v-if="rowIndexList[rowIndex] * gridColumns + colIndex <= data.length">
              <slot
                name="default"
                :index="rowIndexList[rowIndex] * gridColumns + colIndex"
                :item="data[rowIndexList[rowIndex] * gridColumns + colIndex - 1]"
              />
            </template>
          </div>
        </template>
      </div>

      <div v-else class="virtual-scroll-wrapper">
        <div
          v-for="i in virtualRows"
          :key="i"
          :style="{
            '--offset': `var(--t${i})`,
          }"
          :class="itemClass"
          class="virtual-item"
        >
          <template v-if="rowIndexList[i] < data.length">
            <slot name="default" :index="rowIndexList[i]" :item="data[rowIndexList[i]]" />
          </template>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.app-virtual-table {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}

.virtual-scroll-wrapper {
  height: calc(var(--rh) * 1px);
  overflow: hidden;

  &.is-grid {
    display: grid;
    gap: calc(var(--gx) * 1px) calc(var(--gy) * 1px);
    grid-template-columns: repeat(var(--cols), calc(var(--ih) * 1px));
    grid-template-rows: repeat(var(--rows), calc(var(--iw) * 1px));
  }
}

.virtual-item {
  height: calc(var(--iw) * 1px);
  transform: translate(0, calc(var(--offset) * var(--vh) * 1px));
}
</style>
