import type { ShallowRef } from 'vue'
import type { GenshinMapProps } from '../types'
import { GenshinMap } from '../core'

export const useGenshinMap = (
  canvasRef: ShallowRef<HTMLCanvasElement | undefined>,
  options: GenshinMapProps = {},
) => {
  const instanceRef = shallowRef<GenshinMap | null>(null)

  watch(
    canvasRef,
    (canvas, _, onCleanup) => {
      if (!canvas) return
      const instance = new GenshinMap(canvas, options)
      instanceRef.value = instance
      onCleanup(() => {
        instance.finalize()
        instanceRef.value = null
      })
    },
    { flush: 'post', immediate: true },
  )

  return {
    instanceRef,
  }
}
