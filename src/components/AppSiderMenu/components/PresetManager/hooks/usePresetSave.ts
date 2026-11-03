import type { FilterConditions } from '../types'
import type { MAFGroup, MBFItem } from '@/stores/types'
import { usePreferenceStore, useUserStore } from '@/stores'
import { isAdvancedFilter, toConditionsBaseRecord } from '../utils'

export interface PresetSaveOptions {
  name: Ref<string>
  conditionGetter?: Ref<FilterConditions>
}

export const usePresetSave = (options: PresetSaveOptions) => {
  const { name, conditionGetter } = options

  const userStore = useUserStore()
  const preferenceStore = usePreferenceStore()

  /** 保存适配器：基础预设 */
  const saveBasePreset = (conditions: Map<string, MBFItem> | Record<string, MBFItem>) => {
    const newConditions = toConditionsBaseRecord(conditions)
    const presetList = [...preferenceStore.presets]

    const object = {
      name: name.value,
      type: 'basic' as const,
      conditions: newConditions,
    }

    const findIndex = presetList.findIndex(preset => preset.name === name.value)
    if (findIndex < 0) presetList.push(object)
    else presetList.splice(findIndex, 1, object)

    preferenceStore.presets = presetList
    name.value = ''
  }

  /** 保存适配器：高级预设 */
  const saveAdvancedPreset = (conditions: MAFGroup[]) => {
    const presetList = [...preferenceStore.presets]

    const object = {
      name: name.value,
      type: 'advanced' as const,
      conditions,
    }

    const findIndex = presetList.findIndex(preset => preset.name === name.value)
    if (findIndex < 0) presetList.push(object)
    else presetList.splice(findIndex, 1, object)

    preferenceStore.presets = presetList
    name.value = ''
  }

  /** 保存预设 */
  const savePreset = (customConditions?: FilterConditions) => {
    if (userStore.info?.id === undefined) return

    const conditions = customConditions ?? conditionGetter?.value
    if (!conditions) return
    isAdvancedFilter(conditions) ? saveAdvancedPreset(conditions) : saveBasePreset(conditions)
  }

  return {
    savePreset,
  }
}
