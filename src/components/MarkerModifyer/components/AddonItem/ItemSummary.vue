<script lang="ts" setup>
import type { InternalItemData } from './types'
import type { AreaVo, MarkerVo } from '@/api/alova/globals'
import { Plus, Setting } from '@element-plus/icons-vue'
import { ElDropdown } from 'element-plus'
import { useAreaStore, useItemStore } from '@/stores'
import { array2Tree } from '@/utils'
import ItemTabs from './ItemTabs.vue'

const areaStore = useAreaStore()
const itemStore = useItemStore()

const modelValue = defineModel<MarkerVo>({
  required: true,
})

const addonId = defineModel<string>('addonId', {
  required: false,
  default: '',
})

const isAddonActived = computed({
  get: () => addonId.value === 'itemList',
  set: v => (addonId.value = v ? 'itemList' : ''),
})

const areaCodeForAdding = ref<string[]>([])

const areaForAdding = computed(() => {
  if (areaCodeForAdding.value.length < 2) return
  const { 1: code } = areaCodeForAdding.value
  return areaStore.areaCodeMap.get(code)
})

const itemDataList = computed({
  get: () =>
    (modelValue.value.itemList ?? []).reduce((seed, itemLink) => {
      const item = itemStore.itemIdMap.get(itemLink.itemId!)
      if (!item) return seed
      seed.push({
        _raw: item,
        ...itemLink,
      })
      return seed
    }, [] as InternalItemData[]),
  set: list => {
    modelValue.value = {
      ...modelValue.value,
      itemList: list.map(({ itemId, iconId, count = 0 }) => ({
        itemId,
        count,
        iconId,
      })),
    }
  },
})

const areaCode = defineModel<string>('areaCode', {
  required: true,
})

// 只要与地区 tab 交互就激活其附加面板
watch(areaCode, () => {
  isAddonActived.value = true
})

const calculateItemsGroup = () =>
  itemDataList.value.reduce((map, item) => {
    const area = areaStore.areaIdMap.get(item._raw.areaId!)
    if (!area) return map

    if (!map.has(area)) map.set(area, [])

    const items = map.get(area)!

    items.push(JSON.parse(JSON.stringify(item)))

    map.set(area, items)

    return map
  }, new Map<AreaVo, InternalItemData[]>())

/** 按地区分类的物品列表 */
const itemsGroup = defineModel<Map<AreaVo, InternalItemData[]>>('itemsGroup', {
  required: true,
})
itemsGroup.value = calculateItemsGroup()

const areaTree = computed(() => {
  const currentAreaCodeSet = new Set([...itemsGroup.value.keys()].map(area => area.code!))

  return array2Tree(
    areaStore.areaList.map(area => ({
      label: area.name,
      value: area.code,
      id: area.id,
      disabled: currentAreaCodeSet.has(area.code!),
      pid: area.parentId,
    })),
    {
      childrenKey: 'children',
      getId: area => area.id!,
      getPid: area => area.pid!,
      rootId: -1,
    },
  )
})

const internalUpdateFlag = ref(false)

watch(
  () => modelValue.value.itemList,
  (newItemList = []) => {
    if (internalUpdateFlag.value) {
      internalUpdateFlag.value = false
      return
    }

    // 更新内置的地区选择器所选中的地区
    areaCodeForAdding.value = newItemList.reduce((seed, { itemId }) => {
      const item = itemStore.itemIdMap.get(itemId!)
      if (!item) return seed
      const area = areaStore.areaIdMap.get(item.areaId!)
      if (!area) return seed
      seed.push(area.code!)
      return seed
    }, [] as string[])

    // 更新内置的地区分组物品列表
    const newItemsGroup = calculateItemsGroup()
    itemsGroup.value.forEach((_, key) => {
      itemsGroup.value.set(key, [])
    })
    newItemsGroup.forEach((items, key) => {
      itemsGroup.value.set(key, items)
    })
  },
  { deep: true },
)

watch(
  itemsGroup,
  map => {
    const list: InternalItemData[] = []
    map.forEach(items => {
      items.forEach(item => {
        list.push(item)
      })
    })
    internalUpdateFlag.value = true
    itemDataList.value = list
  },
  { deep: true },
)

const dropdownRef = ref<InstanceType<typeof ElDropdown> | null>(null)

const handleAddArea = (area = areaForAdding.value) => {
  if (!area || itemsGroup.value.has(area)) {
    dropdownRef.value?.handleClose()
    return
  }
  itemsGroup.value.set(area, [])
  dropdownRef.value?.handleClose()
  areaCode.value = area.code!
}

const handleRemoveArea = (area: AreaVo) => {
  const itemsGroupMap = new Map(itemsGroup.value)

  const items = itemsGroupMap.get(area)
  if (!items) return

  const keys = [...itemsGroupMap.keys()]

  const searchIndex = keys.indexOf(area)
  if (searchIndex < 0) return

  const preIndex = searchIndex > 0 ? keys[searchIndex - 1] : undefined
  const nextIndex = searchIndex < keys.length - 1 ? keys[searchIndex + 1] : undefined

  const neighborKey = preIndex ?? nextIndex
  if (neighborKey !== undefined) areaCode.value = neighborKey.code!

  itemsGroupMap.delete(area)
  itemsGroup.value = itemsGroupMap
}

const cancel = () => {
  dropdownRef.value?.handleClose()
}

const handleVisibleChange = (visible: boolean) => {
  if (visible) return
  areaCodeForAdding.value = []
}
</script>

<template>
  <div class="item-summary w-full flex gap-1">
    <ItemTabs
      v-model="itemDataList"
      v-model:area-code="areaCode"
      v-model:items-group="itemsGroup"
      v-model:is-addon-actived="isAddonActived"
      @remove-area="handleRemoveArea"
      @add-area="handleAddArea"
      @active="isAddonActived = true"
    />

    <div class="flex flex-col gap-1">
      <ElDropdown ref="dropdownRef" trigger="click" @visible-change="handleVisibleChange">
        <el-button title="添加地区" :icon="Plus" circle />
        <template #dropdown>
          <div class="min-w-[384px] flex flex-col p-2 gap-2">
            <div class="text-sm font-bold">添加地区</div>
            <el-cascader-panel v-model="areaCodeForAdding" :options="areaTree" />
            <div class="flex items-center justify-end overflow-hidden">
              <div class="flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
                <el-text>{{ areaForAdding ? areaForAdding.name : '请选择地区' }}</el-text>
              </div>
              <el-button type="primary" :disabled="!areaForAdding" @click="() => handleAddArea()">
                确定
              </el-button>
              <el-button @click="cancel"> 取消 </el-button>
            </div>
          </div>
        </template>
      </ElDropdown>

      <div title="配置物品">
        <el-button
          :icon="Setting"
          :type="isAddonActived ? 'primary' : ''"
          circle
          @click="isAddonActived = !isAddonActived"
        />
      </div>
    </div>
  </div>
</template>
