import { defaultsDeep, pick } from 'lodash'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useAccessStore, useDadianStore } from '@/stores'

/** 点位额外信息解析 store */
export const useMarkerExtraStore = defineStore('global-marker-extra', () => {
  const accessStore = useAccessStore()
  const dadianStore = useDadianStore()

  const mergedAreaExtraConfigs = computed(() => {
    const { plugins = {}, pluginsBeta = {} } = dadianStore.raw

    const isNegui = accessStore.hasBeta

    const areaExtraConfigs: Record<string, DTO.ExtraConfig> = {}
    for (const areaCode in plugins) {
      const { extra = [], extraConfig = {} } = plugins[areaCode]
      const { extra: extraBeta = [], extraConfig: extraConfigBeta = {} } =
        pluginsBeta[areaCode] ?? {}
      const extraKeys = isNegui ? [...extra, ...extraBeta] : extra
      if (isNegui) defaultsDeep(extraConfig, extraConfigBeta)
      areaExtraConfigs[areaCode] = pick(extraConfig, extraKeys)
    }

    return areaExtraConfigs
  })

  return {
    mergedAreaExtraConfigs,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMarkerExtraStore, import.meta.hot))
}
