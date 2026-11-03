<script setup lang="ts">
import type { InternalItemData } from './types'
import type { AreaVo, ItemVo } from '@/api/alova/globals'
import { formItemContextKey, useFormItem } from 'element-plus'
import { useAreaStore, useItemStore, useItemTypeStore } from '@/stores'
import { AddonTeleporter } from '..'
import ItemDetail from './ItemDetail.vue'
import ItemSubSummary from './ItemSubSummary.vue'

const emits = defineEmits<{
  removeArea: [AreaVo]
  addArea: [AreaVo]
  active: []
}>()

const areaStore = useAreaStore()
const itemStore = useItemStore()
const itemTypeStore = useItemTypeStore()

const isAddonActived = defineModel<boolean>('isAddonActived', {
  required: false,
  default: false,
})

const modelValue = defineModel<InternalItemData[]>('modelValue', {
  required: false,
  default: () => [],
})

const itemsGroup = defineModel<Map<AreaVo, InternalItemData[]>>('itemsGroup', {
  required: false,
  default: () => new Map(),
})

const deleteItem = (item: ItemVo) => {
  const area = areaStore.areaIdMap.get(item.areaId!)
  if (!area) return
  const items = itemsGroup.value.get(area)
  if (!items) return
  const findIndex = items.findIndex(existItem => existItem.itemId === item.id)
  if (findIndex < 0) return
  items.splice(findIndex, 1)
}

const areaCode = defineModel<string>('areaCode', {
  required: false,
  default: '',
})

const { formItem } = useFormItem()

/** 以物品 id 为索引的物品数量映射表，用于物品选择器在切换物品选中状态时的绑定 */
const itemCountIdMap = computed(() =>
  modelValue.value.reduce((map, item) => {
    map.set(item.itemId!, item.count ?? 0)
    return map
  }, new Map<number, number>()),
)

const itemList = computed({
  get: () => {
    const area = areaStore.areaCodeMap.get(areaCode.value)
    if (!area) return []
    return (itemsGroup.value.get(area) ?? []).map(({ _raw }) => _raw)
  },
  set: list => {
    const area = areaStore.areaCodeMap.get(areaCode.value)
    if (!area) return false
    // 从 itemCountIdMap 中继承物品数量
    itemsGroup.value.set(
      area,
      list.map(item => ({
        itemId: item.id,
        count: itemCountIdMap.value.get(item.id!) ?? 1,
        iconId: item.iconId,
        _raw: item,
      })),
    )
  },
})

watch(itemList, () => formItem?.validate('change')?.catch(() => false))

const isAreaDisabled = computed(() => {
  const areaSet = new Set([...itemsGroup.value.keys()].map(area => area.code!))
  return (area: AreaVo) => area.code !== areaCode.value && areaSet.has(area.code!)
})

// 切换地区时使用新地区的同名物品进行替换
const changeArea = (newAreaCode: string, oldAreaCode: string) => {
  const newArea = areaStore.areaCodeMap.get(newAreaCode)
  if (!newArea) return

  const oldArea = areaStore.areaCodeMap.get(oldAreaCode)

  // 如果没有 oldArea，则视为新增地区模式
  if (!oldArea) {
    emits('addArea', newArea)
    return
  }

  /** 根据新地区 code 过滤出该地区的物品并构建物品名称映射表 */
  const itemNameMap = itemStore.itemList.reduce((map, item) => {
    if (item.areaId !== newArea.id) return map
    const itemName = item.name ?? ''
    if (!map.has(itemName)) map.set(itemName, [])
    const items = map.get(itemName)!
    items.push(item)
    return map
  }, new Map<string, ItemVo[]>())

  /** 构建旧地区物品名称与数量映射表 */
  const itemCountNameMap = (itemsGroup.value.get(oldArea) ?? []).reduce((map, item) => {
    map.set(item._raw.name!, item.count ?? 0)
    return map
  }, new Map<string, number>())

  /** 新地区物品分组 */
  const newItemsGroup = new Map<AreaVo, InternalItemData[]>()

  // 用新地区替换旧地区，保持 map 内键的顺序不变
  itemsGroup.value.forEach((items, area) => {
    if (area.code !== oldAreaCode) {
      newItemsGroup.set(area, items)
      return
    }

    /** 查找新地区具备相同名称的物品 */
    const itemsWithSameName: InternalItemData[] = []

    items.forEach(({ _raw: { name = '' } }) => {
      const itemsInNewArea = itemNameMap.get(name)
      if (!itemsInNewArea?.length) return
      itemsInNewArea.forEach(item =>
        itemsWithSameName.push({
          _raw: item,
          itemId: item.id,
          // 从旧地区的物品名称与数量映射表中继承物品数量
          count: itemCountNameMap.get(item.name ?? '') ?? 1,
          iconId: item.iconId,
        }),
      )
    })

    newItemsGroup.set(newArea, itemsWithSameName)
  })

  itemsGroup.value = newItemsGroup
  areaCode.value = newAreaCode
}

const prepareToAddItem = () => {
  if (isAddonActived.value) return
  formItem?.clearValidate()
  areaCode.value = ''
  isAddonActived.value = true
}

const virtualRef = ref<HTMLElement>()
const popoverItems = shallowRef<number[]>([])

const formItemContext = inject(formItemContextKey, undefined)
const isError = computed(() => formItemContext?.validateState === 'error')
</script>

<template>
  <div class="item-summary-tabs">
    <div
      v-if="!itemsGroup.size"
      class="empty-button h-full border rounded grid place-items-center transition-all"
      :class="
        isAddonActived
          ? 'border-[var(--el-color-primary)] \
        text-[var(--el-color-primary)]'
          : 'border-[var(--el-border-color)] \
        text-[var(--el-text-color-secondary)] \
        hover:bg-[var(--el-color-primary-light-9)] \
        active:border-[var(--el-color-primary)] \
        active:text-[var(--el-color-primary)] \
        cursor-pointer'
      "
      @click="prepareToAddItem"
    >
      添加物品
    </div>

    <div v-else class="tab-headers">
      <div class="flex-1 overflow-hidden">
        <el-tabs
          v-model="areaCode"
          class="item-tabs-header"
          type="border-card"
          :style="{
            'border-color': isError
              ? 'var(--el-color-danger)'
              : isAddonActived
                ? 'var(--el-color-primary)'
                : 'var(--el-border-color)',
          }"
          @tab-click="() => emits('active')"
        >
          <el-tab-pane
            v-for="[area, items] in itemsGroup"
            :key="area.id"
            :label="area.name"
            :name="area.code"
          >
            <template #label>
              <div class="h-full text-xs flex items-center gap-1">
                <div class="w-20 flex flex-col overflow-hidden">
                  <div class="w-full whitespace-nowrap text-ellipsis overflow-hidden">
                    {{ areaStore.areaIdMap.get(area.parentId ?? -1)?.name ?? 'unknown' }}
                  </div>
                  <div
                    class="w-full whitespace-nowrap text-ellipsis overflow-hidden"
                    :title="area.name"
                  >
                    {{ area.name }}
                  </div>
                </div>
              </div>
            </template>

            <div class="h-[70px]">
              <div v-if="!items.length" class="text-center px-2">当前地区没有物品</div>
              <div v-if="!items.length" class="w-full flex items-center justify-center gap-2">
                <el-button
                  text
                  type="danger"
                  style="padding: 4px 8px"
                  @click="() => emits('removeArea', area)"
                >
                  删除地区
                </el-button>
                <div class="text-[var(--el-text-color-secondary)]">或</div>
                <el-button
                  text
                  type="primary"
                  style="padding: 4px 8px"
                  @click="() => emits('active')"
                >
                  添加物品
                </el-button>
              </div>
              <el-scrollbar always noresize>
                <ItemSubSummary
                  v-for="item in items"
                  :key="item.itemId"
                  v-model:count="item.count"
                  v-model:virtual-ref="virtualRef"
                  v-model:popover-items="popoverItems"
                  :data="item"
                  class="h-[32px]"
                  @delete="() => deleteItem(item._raw)"
                />
              </el-scrollbar>
            </div>
          </el-tab-pane>

          <template #add-icon>
            <el-icon title="添加地区">
              <Plus />
            </el-icon>
          </template>
        </el-tabs>

        <el-popover
          :virtual-ref="virtualRef"
          :disabled="popoverItems.length <= 0"
          trigger="hover"
          virtual-triggering
        >
          <div
            v-for="id in popoverItems"
            :key="id"
            class="h-5 leading-5 bg-[var(--el-color-warning-light-9)] text-[var(--el-color-warning)] text-xs px-1 rounded-sm"
          >
            {{ itemTypeStore.itemTypeIdMap.get(id)?.name ?? `(id:${id})` }}
          </div>
        </el-popover>
      </div>
    </div>

    <AddonTeleporter :active="isAddonActived">
      <ItemDetail
        v-model="itemList"
        :area-code="areaCode"
        :is-area-disabled="isAreaDisabled"
        @update:area-code="code => changeArea(code, areaCode)"
      />
    </AddonTeleporter>
  </div>
</template>

<style scoped>
.item-summary-tabs {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 4px;
}

.item-tabs-header {
  --tab-header-height: 40px;

  border-radius: 4px;
  overflow: hidden;

  :deep(.el-tabs__content) {
    padding: 0;
  }

  :deep(.el-tabs__item) {
    height: var(--tab-header-height);
    padding: 0 6px !important;
  }

  :deep(.el-tabs__new-tab) {
    margin: 10px;
  }

  :deep(.el-tabs__nav-next) {
    line-height: var(--tab-header-height);
  }
  :deep(.el-tabs__nav-prev) {
    line-height: var(--tab-header-height);
  }
}
</style>
