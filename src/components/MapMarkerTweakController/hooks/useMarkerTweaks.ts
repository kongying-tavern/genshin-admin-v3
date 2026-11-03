import type { TweakControlInfo } from '.'
import type { MarkerVo, TweakConfigMetaVo, TweakConfigVo, TweakVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'
import { useMarkerStore } from '@/stores'

export interface TweakHookOptions {
  markerList: Ref<MarkerVo[]>
  tweakList: Ref<TweakControlInfo[]>
  tweakData: Ref<Map<string, TweakConfigMetaVo>>
}

export const useMarkerTweaks = (options: TweakHookOptions) => {
  const { markerList, tweakList, tweakData } = options
  const markerStore = useMarkerStore()

  const isDisabled = computed(() => !tweakList.value.length)

  const {
    refresh: submit,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async () => {
      const markerIds = markerList.value.map(marker => marker.id!)

      // 处理自定义批量修改
      const customTweaks = tweakList.value.filter(({ isCustom }) => isCustom)

      await Promise.all(
        customTweaks.map(async ({ id, modifier }) => {
          const meta = tweakData.value.get(id)!
          await modifier.options.customModify?.(markerList.value, meta)
        }),
      )

      // 处理通用批量修改
      const tweaks = tweakList.value.map(({ id, prop, modifier }) => {
        const meta = tweakData.value.get(id)!
        const config: TweakConfigVo = {
          prop,
          type: modifier.options.type,
          meta,
        }
        return config
      })

      const payload: TweakVo[] = [
        {
          markerIds,
          tweaks,
        },
      ]

      if (!tweaks.length) return []
      await markerStore.tweakMarkers(payload)
    },
  })

  onSuccess(() => {
    ElMessage.success({
      message: '批量编辑成功',
    })
  })

  onError(err => {
    ElMessage.error({
      message: `批量编辑失败，原因为：${err.message}`,
    })
  })

  return {
    isDisabled,
    submit,
    onSuccess,
    ...rest,
  }
}
