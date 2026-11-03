import type { MAFModelId } from '@/shared'
import type { useArchiveStore } from '@/stores'
import type {
  MAFConfig,
  MAFGroup,
  MAFGroupComposed,
  MAFItem,
  MAFItemComposed,
  MAFMeta,
  MAFValue,
} from '@/stores/types'
import { cloneDeep, keyBy } from 'lodash'
import {
  Area,
  ContentContain,
  ContentRegex,
  IdRange,
  Image,
  ItemCount,
  ItemName,
  ItemNameRegex,
  ItemSize,
  ItemType,
  Linkage,
  LinkageAction,
  RefreshTime,
  TitleContain,
  Underground,
  UndergroundLayer,
  Video,
  Visibility,
} from './models'

interface MarkerAdvancedFilterHookOptions {
  archiveStore: ReturnType<typeof useArchiveStore>
}

// ==================== 模型配置 ====================
const configList = [
  new IdRange(),
  new TitleContain(),
  new ContentContain(),
  new ContentRegex(),
  new Underground(),
  new UndergroundLayer(),
  new Image(),
  new Video(),
  new Linkage(),
  new LinkageAction(),
  new RefreshTime(),
  new Visibility(),
  new Area(),
  new ItemType(),
  new ItemName(),
  new ItemNameRegex(),
  new ItemSize(),
  new ItemCount(),
]

const configMap: Record<MAFModelId, MAFConfig> = keyBy(
  configList as unknown as MAFConfig[],
  'id',
) as Record<MAFModelId, MAFConfig>

const createEmptyGroup = (): MAFGroup => ({
  key: crypto.randomUUID(),
  operator: true,
  opposite: false,
  children: [],
})

const createEmptyItem = (): MAFItem => ({
  id: 0 as MAFModelId,
  key: crypto.randomUUID(),
  operator: true,
  opposite: false,
  value: {},
})

let cache: ReturnType<typeof _useMarkerAdvancedFilter>

const _useMarkerAdvancedFilter = (options: MarkerAdvancedFilterHookOptions) => {
  const { archiveStore } = options

  const advancedFilter = computed({
    get: () =>
      archiveStore.currentArchive.body.Preference['markerFilter.filter.advancedFilter'] ?? [],
    set: filter => {
      archiveStore.currentArchive.body.Preference['markerFilter.filter.advancedFilter'] = filter
    },
  })

  const advancedFilterCache = computed({
    get: () =>
      archiveStore.currentArchive.body.Preference['markerFilter.filter.advancedFilterCache'] ?? [],
    set: cache => {
      archiveStore.currentArchive.body.Preference['markerFilter.filter.advancedFilterCache'] = cache
    },
  })

  const getMAFConfig = (id: MAFModelId): MAFConfig =>
    configMap[id] ?? {
      id: 0 as MAFModelId,
      name: '',
      option: {},
      defaultVal: {},
      semantic: () => '',
      filter: () => true,
    }

  const getCount = (filter: MAFGroup[] = []) => {
    return filter.reduce((sum, group) => {
      return sum + group.children.length
    }, 0)
  }

  const conditionComposed = computed<MAFGroupComposed[]>({
    get: () => {
      const groupComposed: MAFGroupComposed[] = []
      const filters = advancedFilterCache.value

      // 处理组
      filters.forEach(filter => {
        const {
          key: groupKey,
          operator: groupOperator = true,
          opposite: groupOpposite = false,
          children = [],
        } = filter
        const itemComposed: MAFItemComposed[] = []

        // 处理子项
        children.forEach(child => {
          const {
            key,
            id = 0 as MAFModelId,
            operator: itemOperator,
            opposite: itemOpposite,
            value = {},
          } = child
          const { option, prepare, semantic, filter } = getMAFConfig(id)
          let meta: MAFMeta = {}
          if (prepare && typeof prepare === 'function') meta = prepare(value, toValue(option))
          const obj = {
            key,
            id,
            operator: itemOperator,
            opposite: itemOpposite,
            value,
            option,
            meta,
            semantic,
            filter,
          } satisfies MAFItemComposed
          itemComposed.push(obj)
        })

        groupComposed.push({
          key: groupKey,
          operator: groupOperator,
          opposite: groupOpposite,
          children: itemComposed,
        })
      })

      return groupComposed
    },
    set: (list: MAFGroupComposed[]) => {
      const convertedData: MAFGroup[] = []
      list.forEach(group => {
        const {
          key: groupKey,
          operator: groupOperator = true,
          opposite: groupOpposite = false,
          children = [],
        } = group
        const convertedChildren: MAFItem[] = children.map(child => {
          const {
            id = 0 as MAFModelId,
            key,
            operator: itemOperator = true,
            opposite: itemOpposite = false,
            value = {} as MAFValue,
          } = child
          return {
            id,
            key,
            operator: itemOperator,
            opposite: itemOpposite,
            value,
          }
        })
        convertedData.push({
          key: groupKey,
          operator: groupOperator,
          opposite: groupOpposite,
          children: convertedChildren,
        })
      })

      advancedFilterCache.value = convertedData
    },
  })

  const conditionCacheCount = computed(() => getCount(advancedFilterCache.value))

  const conditionCount = computed(() => getCount(advancedFilter.value))

  const conditionSame = computed(() => {
    const cache = advancedFilterCache.value
    const filter = advancedFilter.value
    if (cache.length !== filter.length) return false
    else if (conditionCacheCount.value !== conditionCount.value) return false
    return JSON.stringify(cache) === JSON.stringify(filter)
  })

  const initCondition = () => {
    if (advancedFilterCache.value.length <= 0) advancedFilterCache.value.push(createEmptyGroup())
  }

  const toggleConditionGroupOperator = (groupIndex: number) => {
    const group = advancedFilterCache.value[groupIndex]
    if (group) group.operator = !(group.operator ?? true)
  }

  const toggleConditionGroupOpposite = (groupIndex: number) => {
    const group = advancedFilterCache.value[groupIndex]
    if (group) group.opposite = !(group.opposite ?? false)
  }

  const appendConditionGroup = () => {
    advancedFilterCache.value = [...advancedFilterCache.value, createEmptyGroup()]
  }

  const insertConditionGroup = (groupIndex: number) => {
    if (groupIndex > advancedFilterCache.value.length) {
      appendConditionGroup()
      return
    }
    if (groupIndex < 0) groupIndex = 0
    advancedFilterCache.value.splice(groupIndex, 0, createEmptyGroup())
  }

  const swapConditionGroup = (groupIndexLeft: number, groupIndexRight: number) => {
    const left = advancedFilterCache.value[groupIndexLeft]
    const right = advancedFilterCache.value[groupIndexRight]
    if (left && right) {
      advancedFilterCache.value.splice(groupIndexLeft, 1, right)
      advancedFilterCache.value.splice(groupIndexRight, 1, left)
    }
  }

  const deleteConditionGroup = (groupIndex: number) => {
    if (advancedFilterCache.value[groupIndex]) advancedFilterCache.value.splice(groupIndex, 1)
    initCondition()
  }

  const toggleConditionOperator = (groupIndex: number, itemIndex: number) => {
    const item = advancedFilterCache.value[groupIndex]?.children[itemIndex]
    if (item) item.operator = !(item.operator ?? true)
  }

  const toggleConditionOpposite = (groupIndex: number, itemIndex: number) => {
    const item = advancedFilterCache.value[groupIndex]?.children[itemIndex]
    if (item) item.opposite = !(item.opposite ?? false)
  }

  const appendCondition = (groupIndex: number, id: MAFModelId = 0 as MAFModelId) => {
    if (advancedFilterCache.value[groupIndex].children) {
      const conditionModel = getMAFConfig(id)
      const newItem = createEmptyItem()
      newItem.id = id
      newItem.value = cloneDeep(conditionModel.defaultVal)
      advancedFilterCache.value[groupIndex].children.push(newItem)
    }
  }

  const insertCondition = (
    groupIndex: number,
    itemIndex: number,
    id: MAFModelId = 0 as MAFModelId,
  ) => {
    if (!advancedFilterCache.value[groupIndex]) return

    if (itemIndex > advancedFilterCache.value[groupIndex].children.length) {
      appendCondition(groupIndex, id)
      return
    }
    if (itemIndex < 0) itemIndex = 0
    const conditionModel = getMAFConfig(id)
    const newItem = createEmptyItem()
    newItem.id = id
    newItem.value = cloneDeep(conditionModel.defaultVal)
    advancedFilterCache.value[groupIndex].children.splice(itemIndex, 0, newItem)
  }

  const swapCondition = (groupIndex: number, itemIndexLeft: number, itemIndexRight: number) => {
    if (!advancedFilterCache.value[groupIndex]) return

    const left = advancedFilterCache.value[groupIndex].children[itemIndexLeft]
    const right = advancedFilterCache.value[groupIndex].children[itemIndexRight]
    if (left && right) {
      advancedFilterCache.value[groupIndex].children.splice(itemIndexLeft, 1, right)
      advancedFilterCache.value[groupIndex].children.splice(itemIndexRight, 1, left)
    }
  }

  const deleteCondition = (groupIndex: number, itemIndex: number) => {
    if (
      advancedFilterCache.value[groupIndex]
      && advancedFilterCache.value[groupIndex].children[itemIndex]
    ) {
      advancedFilterCache.value[groupIndex].children.splice(itemIndex, 1)
    }
  }

  const reorderCondition = (groupIndex: number, orderedKeys: string[]) => {
    const group = advancedFilterCache.value[groupIndex]
    if (!group?.children.length) return
    const { children } = group
    if (!orderedKeys.length || orderedKeys.length !== children.length) return
    // 拖拽未改变顺序时跳过，避免触发无意义的缓存写入
    if (orderedKeys.every((key, index) => children[index].key === key)) return
    const childMap = new Map(children.map(child => [child.key, child]))
    const reordered = orderedKeys.map(key => childMap.get(key))
    // 存在无法匹配的 key 时放弃写回，避免拖拽态与缓存不一致时丢失条目
    if (reordered.some(child => !child)) return
    group.children = reordered as MAFItem[]
  }

  const copyConditions = () => {
    advancedFilter.value = cloneDeep(advancedFilterCache.value)
  }

  const clearConditions = () => {
    advancedFilterCache.value = []
    initCondition()
  }

  return {
    markerAdvancedFilterConfigs: configList,
    markerAdvancedFilterConfigMap: configMap,
    getMAFConfig,

    markerAdvancedFilters: advancedFilterCache,
    markerAdvancedComposed: conditionComposed,
    markerAdvancedCacheCount: conditionCacheCount,
    markerAdvancedCount: conditionCount,
    markerAdvancedSame: conditionSame,
    copyMAFCache: copyConditions,
    clearMAFCache: clearConditions,
    toggleMAFGroupOperator: toggleConditionGroupOperator,
    toggleMAFGroupOpposite: toggleConditionGroupOpposite,
    appendMAFGroup: appendConditionGroup,
    insertMAFGroup: insertConditionGroup,
    swapMAFGroup: swapConditionGroup,
    deleteMAFGroup: deleteConditionGroup,
    toggleMAFItemOperator: toggleConditionOperator,
    toggleMAFItemOpposite: toggleConditionOpposite,
    appendMAFItem: appendCondition,
    insertMAFItem: insertCondition,
    swapMAFItem: swapCondition,
    reorderMAFItems: reorderCondition,
    deleteMAFItem: deleteCondition,
  }
}

export const useMarkerAdvancedFilter = (options: MarkerAdvancedFilterHookOptions) => {
  if (!cache) cache = _useMarkerAdvancedFilter(options)
  return cache
}
