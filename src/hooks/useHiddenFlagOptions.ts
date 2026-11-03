import { HIDDEN_FLAG_OPTIONS } from '@/shared'
import { useAccessStore } from '@/stores'

export const useHiddenFlagOptions = () => {
  const accessStore = useAccessStore()

  const hiddenFlagOptions = useArrayFilter(HIDDEN_FLAG_OPTIONS, ({ value }) =>
    accessStore.checkHiddenFlag(value),
  )

  const hiddenFlagNameMap = computed(() =>
    Object.fromEntries(hiddenFlagOptions.value.map(({ label, value }) => [value, label])),
  )

  const hiddenFlagMap = computed(() =>
    Object.fromEntries(hiddenFlagOptions.value.map(({ label, value }) => [label, value])),
  )

  return {
    hiddenFlagOptions,
    hiddenFlagNameMap,
    hiddenFlagMap,
  }
}
