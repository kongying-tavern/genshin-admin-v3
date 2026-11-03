import { usePreferenceStore, useUserStore } from '@/stores'

export interface PresetDeleteOptions {
  name: Ref<string>
}

export const usePresetDelete = (options: PresetDeleteOptions) => {
  const { name } = options

  const userStore = useUserStore()
  const preferenceStore = usePreferenceStore()

  /** 删除预设 */
  const deletePreset = () => {
    if (userStore.info?.id === undefined) return

    const newPresets = [...preferenceStore.presets]
    const findIndex = newPresets.findIndex(preset => preset.name === name.value)
    if (findIndex < 0) return

    newPresets.splice(findIndex, 1)

    preferenceStore.presets = newPresets
  }

  return {
    deletePreset,
  }
}
