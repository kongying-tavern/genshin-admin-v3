import { acceptHMRUpdate, defineStore } from 'pinia'
import { useAccessStore, useDadianStore } from '@/stores'
import { resolveMarkerExtras } from './systemConfigLayers'

/** 点位额外信息解析 store */
export const useMarkerExtraStore = defineStore('global-marker-extra', () => {
  const accessStore = useAccessStore()
  const dadianStore = useDadianStore()

  const resolved = computed(() => resolveMarkerExtras(dadianStore.raw, accessStore.hasBeta))
  const mergedAreaExtraConfigs = computed(() => resolved.value.mergedAreaExtraConfigs)
  const enabledExtrasByArea = computed(() => resolved.value.enabledExtrasByArea)

  return {
    enabledExtrasByArea,
    mergedAreaExtraConfigs,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMarkerExtraStore, import.meta.hot))
}
