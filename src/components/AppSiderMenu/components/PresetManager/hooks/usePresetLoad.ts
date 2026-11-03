import type { FilterConditions } from '../types'
import type { MAFGroup, MBFItem } from '@/stores/types'
import { cloneDeep } from 'lodash'
import { usePreferenceStore, useUserStore } from '@/stores'
import { isAdvancedFilter, toConditionsBaseRecord } from '../utils'

export interface PresetLoadOptions {
  name: Ref<string>
  loadCallback?: (success: boolean) => void
}

export const usePresetLoad = (options: PresetLoadOptions) => {
  const { name, loadCallback } = options

  const userStore = useUserStore()
  const preferenceStore = usePreferenceStore()

  /** 读取适配器：基础预设 */
  const loadBasePreset = (conditions: Record<string, MBFItem>) => {
    const itemIds: number[] = []

    // 读取最后条件的选择地区和类型作为筛选器当前状态
    let latestAreaCode: string | undefined
    let latestTypeId: number | undefined
    for (const key in conditions) {
      const condition = conditions[key]
      itemIds.push(...condition.items)
      latestAreaCode = condition.area.code
      latestTypeId = condition.type.id
    }

    preferenceStore.filterType = 'basic'
    if (latestAreaCode !== undefined) {
      const { 1: zone } = latestAreaCode.split(':')
      preferenceStore.parentAreaCode = `C:${zone}`
      preferenceStore.areaCode = latestAreaCode
    }
    if (latestTypeId !== undefined) preferenceStore.itemTypeId = latestTypeId
    preferenceStore.itemIds = itemIds
    preferenceStore.step = 2
  }

  /** 读取适配器：高级预设 */
  const loadAdvancedPreset = (conditions: MAFGroup[]) => {
    preferenceStore.filterType = 'advanced'
    preferenceStore.advancedFilter = conditions
    preferenceStore.advancedFilterCache = cloneDeep(conditions)
  }

  /** 读取预设 */
  const loadPreset = (customConditions?: FilterConditions) => {
    if (userStore.info?.id === undefined) return

    try {
      const conditions =
        customConditions
        ?? preferenceStore.presets.find(preset => preset.name === name.value)?.conditions
      if (!conditions) return

      isAdvancedFilter(conditions)
        ? loadAdvancedPreset(conditions)
        : loadBasePreset(toConditionsBaseRecord(conditions))
      loadCallback?.(true)
    } catch {
      loadCallback?.(false)
    }
  }

  return {
    loadPreset,
  }
}
