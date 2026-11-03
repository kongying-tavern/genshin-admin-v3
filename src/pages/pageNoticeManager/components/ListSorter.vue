<script setup lang="ts">
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { AppDraggableTable } from '@/components'

const props = defineProps<{
  options: { label: string; key: string }[]
  visible: boolean
}>()

const emits = defineEmits<{
  change: [string[]]
  cancel: []
}>()

const optionsMap = computed(() =>
  props.options.reduce((map, { key, label }) => {
    map.set(key, label)
    return map
  }, new Map<string, string>()),
)

const modelValue = defineModel<string[]>('modelValue', {
  required: false,
  default: () => [],
})

const parseSorters = (sortUnits: string[]) => {
  return sortUnits.reduce(
    (seed, unit) => {
      const flag = unit.slice(-1)
      const key = unit.slice(0, -1)
      seed.push({ key, flag })
      return seed
    },
    [] as { key: string; flag: string }[],
  )
}

const stringifySorters = (list: { key: string; flag: string }[]) => {
  return list.map(({ key, flag }) => `${key}${flag}`)
}

const sortList = ref<ReturnType<typeof parseSorters>>([])

whenever(
  () => props.visible,
  () => {
    sortList.value = parseSorters(modelValue.value)
  },
)

const keysInSortList = computed(() =>
  sortList.value.reduce((set, { key }) => {
    set.add(key)
    return set
  }, new Set<string>()),
)

const visibleOptions = computed(() =>
  props.options.filter(({ key }) => !keysInSortList.value.has(key)),
)

const confirm = () => {
  const res = stringifySorters(sortList.value)
  modelValue.value = res
  emits('change', res)
}

const cancel = () => {
  emits('cancel')
}

const selectedSortKey = ref<string>('')
const isAddMode = ref(true)

const addToSort = () => {
  const key = toValue(selectedSortKey)

  if (!isAddMode.value || keysInSortList.value.has(key)) return

  sortList.value.push({
    key,
    flag: '-',
  })
}

const removeSort = () => {
  const key = toValue(selectedSortKey)

  if (isAddMode.value || !keysInSortList.value.has(key)) return

  const index = sortList.value.findIndex(({ key: findKey }) => findKey === key)
  sortList.value.splice(index, 1)
}

const selectSortKey = (key: string, isAdding = false) => {
  selectedSortKey.value = key
  isAddMode.value = isAdding
}
</script>

<template>
  <div class="p-2 flex flex-col">
    <div class="w-full grid grid-cols-[160px_42px_176px]">
      <div
        class="border border-[var(--el-border-color)] rounded rounded-b-none bg-[var(--el-color-info-light-7)] px-1 py-0.5 font-bold"
      >
        可用排序
      </div>
      <div />
      <div
        class="border border-[var(--el-border-color)] rounded rounded-b-none bg-[var(--el-color-info-light-7)] px-1 py-0.5 font-bold"
      >
        当前排序
      </div>

      <div
        class="h-52 border border-t-0 border-[var(--el-border-color)] rounded rounded-t-none overflow-auto"
      >
        <div
          v-for="option in visibleOptions"
          :key="option.key"
          :class="{
            'is-actived': isAddMode && option.key === selectedSortKey,
          }"
          class="sorter-item"
          @click="() => selectSortKey(option.key, true)"
        >
          {{ option.label }}
        </div>
      </div>

      <div class="h-52 grid place-items-center place-content-center px-2 gap-2">
        <div>
          <el-button
            :disabled="!isAddMode || !selectedSortKey"
            :icon="ArrowRight"
            size="small"
            type="primary"
            style="padding: 4px 6px"
            @click="addToSort"
          />
        </div>
        <div>
          <el-button
            :disabled="isAddMode || !selectedSortKey"
            :icon="ArrowLeft"
            size="small"
            type="primary"
            style="padding: 4px 6px"
            @click="removeSort"
          />
        </div>
      </div>

      <div
        class="h-52 border border-t-0 border-[var(--el-border-color)] rounded rounded-t-none overflow-auto"
      >
        <AppDraggableTable v-model="sortList" :get-key="item => item.key">
          <template #default="{ item, index, isGrabbing, isDragging }">
            <div
              :class="{
                'is-actived': !isAddMode && item.key === selectedSortKey,
                'is-dragging': isDragging,
                'is-grabbing': isGrabbing,
              }"
              class="sorter-item justify-between"
              @click="() => selectSortKey(item.key)"
            >
              <div>{{ index + 1 }}. {{ optionsMap.get(item.key) ?? item.key }}</div>
              <div>
                <el-switch
                  v-model="item.flag"
                  size="small"
                  inline-prompt
                  active-text="升序"
                  inactive-text="降序"
                  active-value="+"
                  inactive-value="-"
                />
              </div>
            </div>
          </template>
        </AppDraggableTable>
      </div>
    </div>

    <div class="flex justify-end pt-2">
      <el-button size="small" type="primary" @click="confirm"> 确认 </el-button>
      <el-button size="small" @click="cancel"> 取消 </el-button>
    </div>
  </div>
</template>

<style scoped>
.sorter-item {
  transition: all ease 150ms;
  user-select: none;
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 4px;

  &:not(.is-dragging) {
    cursor: pointer;
  }

  &:not(.is-dragging):hover {
    background: var(--el-fill-color-light);
  }
  &:not(.is-dragging):active {
    background: var(--el-fill-color);
  }

  &.is-actived {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  &.is-grabbing {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }
}
</style>
