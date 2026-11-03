import { useUserStore } from '@/stores'
import { usePresetSave, usePresetUnzip } from '.'

export interface PresetImportOptions {
  code?: MaybeRef<string>
  name: Ref<string>
  importCallback?: (success: boolean) => void
}

/** 导入预设分享码 */
export const usePresetImport = (options: PresetImportOptions) => {
  const { name, importCallback } = options

  const userStore = useUserStore()

  const code = options.code ?? shallowRef<string>('')
  const { conditions: importConditions } = usePresetUnzip(code)
  const { savePreset } = usePresetSave({ name })

  const importCode = () => {
    if (userStore.info?.id === undefined) return
    if (!unref(code)) return
    if (!name.value) return

    try {
      savePreset(importConditions.value)
      importCallback?.(true)
    } catch {
      importCallback?.(false)
    }
  }

  return {
    importCode,
    importConditions,
  }
}
