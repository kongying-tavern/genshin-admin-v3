import { useDadianStore } from '@/stores'

let _cache: ReturnType<typeof _useRefreshTimeOptions> | undefined

export const _useRefreshTimeOptions = () => {
  const dadianStore = useDadianStore()

  const refreshTimeOptions = computed(() => {
    const { refreshTimeSpecial = [] } = dadianStore.raw.editor ?? {}
    return [
      { label: '不刷新', value: 0 },
      { label: '自定义', value: 12 * 3600 * 1000 },
      ...refreshTimeSpecial,
    ]
  })

  const refreshTimeTypeOptions = computed(() =>
    refreshTimeOptions.value.map(({ label }) => ({ label, value: label })),
  )

  const refreshTimeTypeNameMap = computed(() =>
    Object.fromEntries(refreshTimeOptions.value.map(({ label, value }) => [value, label])),
  )

  const refreshTimeTypeMap = computed(() =>
    Object.fromEntries(refreshTimeOptions.value.map(({ label, value }) => [label, value])),
  )

  return {
    refreshTimeOptions,
    refreshTimeTypeOptions,
    refreshTimeTypeNameMap,
    refreshTimeTypeMap,
  }
}

export const useRefreshTimeOptions = () => {
  if (!_cache) _cache = _useRefreshTimeOptions()
  return _cache
}
