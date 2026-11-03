import { useRefreshTimeOptions } from '.'

interface RefreshTimeHookOptions {
  toHumanFriendly?: (days: number, hours: number, minutes: number) => string
}

export const useRefreshTime = (
  refreshTime: Ref<number | undefined>,
  options: RefreshTimeHookOptions = {},
) => {
  const { toHumanFriendly } = options

  const { refreshTimeOptions, refreshTimeTypeOptions, refreshTimeTypeNameMap, refreshTimeTypeMap } =
    useRefreshTimeOptions()

  const refreshTimeType = computed({
    get: () => {
      if (!refreshTime.value) return '不刷新'
      if (refreshTime.value < 0) return refreshTimeTypeNameMap.value[refreshTime.value]
      return '自定义'
    },
    set: v => {
      refreshTime.value = refreshTimeTypeMap.value[v]
    },
  })

  const isCustom = computed(() => refreshTime.value !== undefined && refreshTime.value > 0)

  const humanFriendlyTimeText = computed(() => {
    const time = Number(refreshTime.value) || 0
    if (time <= 0) return refreshTimeType.value
    const days = Math.floor(time / 86400000)
    const hours = Math.floor((time % 86400000) / 3600000)
    const minutes = Math.floor((time % 3600000) / 60000)
    return toHumanFriendly?.(days, hours, minutes) ?? `${days} 天 ${hours} 小时 ${minutes} 分钟`
  })

  return {
    refreshTimeOptions,
    refreshTimeTypeOptions,
    refreshTimeTypeNameMap,
    refreshTimeTypeMap,
    refreshTimeType,
    isCustom,
    humanFriendlyTimeText,
  }
}
