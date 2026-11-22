import type { TweakControlInfo } from '.'
import type { MarkerVo, TweakConfigMetaVo, TweakConfigVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useAccessStore, useMarkerStore } from '@/stores'
import { messageFrom } from '@/utils'

export interface TweakHookOptions {
  markerList: Ref<MarkerVo[]>
  tweakList: Ref<TweakControlInfo[]>
  tweakData: Ref<Map<string, TweakConfigMetaVo>>
  getGeneration: () => number | undefined
}

export const useMarkerTweaks = (options: TweakHookOptions) => {
  const { markerList, tweakList, tweakData, getGeneration } = options
  const markerStore = useMarkerStore()
  const accessStore = useAccessStore()
  const pending = ref<number>()
  const loading = computed(() => pending.value !== undefined && pending.value === getGeneration())
  const isDisabled = computed(() => !tweakList.value.length)
  const isCurrent = (generation: number) =>
    getGeneration() === generation && accessStore.get('MARKER_BATCH_EDIT')

  const submit = async () => {
    const generation = getGeneration()
    if (generation === undefined || loading.value || !isCurrent(generation)) return
    pending.value = generation

    try {
      const markers = [...markerList.value]
      const markerIds = markers.map(marker => marker.id!)
      const changes = tweakList.value.map(({ id, prop, modifier, isCustom }) => ({
        prop,
        isCustom,
        meta: tweakData.value.get(id)!,
        options: modifier.options,
      }))
      const tweaks = changes.map(({ prop, meta, options }): TweakConfigVo => ({
        prop,
        type: options.type,
        meta,
      }))

      await Promise.all(
        changes
          .filter(change => change.isCustom)
          .map(({ options, meta }) => options.customModify?.(markers, meta)),
      )
      if (!isCurrent(generation)) return
      if (tweaks.length) await markerStore.tweakMarkers([{ markerIds, tweaks }])
      if (isCurrent(generation)) ElMessage.success({ message: '批量编辑成功' })
    } catch (error) {
      if (isCurrent(generation)) {
        ElMessage.error({ message: `批量编辑失败，原因为：${messageFrom(error)}` })
      }
    } finally {
      if (pending.value === generation) pending.value = undefined
    }
  }

  return { isDisabled, submit, loading }
}
