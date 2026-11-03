import type { Layer } from 'deck.gl'
import type { ShallowRef } from 'vue'
import type { TempLayerIndex } from '@/shared'

/**
 * 临时图层将会附加在指定 index 的图层之上
 */
export const useTempLayers = () => {
  const tempLayerMap = shallowRef(new Map<TempLayerIndex, Map<string, Layer>>())

  const set = (index: TempLayerIndex, layer: Layer) => {
    if (!tempLayerMap.value.has(index)) tempLayerMap.value.set(index, new Map())
    if (!layer.id) throw new Error('图层 id 为空')
    const layers = tempLayerMap.value.get(index)!
    layers.set(layer.id, layer)
    triggerRef(tempLayerMap)
  }

  const toLayers = (index: TempLayerIndex, bool = true) => {
    const res: Layer[] = []
    if (bool) tempLayerMap.value.get(index)?.forEach(layer => res.push(layer))
    return res
  }

  const remove = (index: TempLayerIndex, layerId?: string) => {
    if (!tempLayerMap.value.has(index)) return
    if (!layerId) {
      tempLayerMap.value.delete(index)
      triggerRef(tempLayerMap)
      return
    }
    const layers = tempLayerMap.value.get(index)!
    if (!layers.has(layerId)) return
    layers.delete(layerId)
    triggerRef(tempLayerMap)
  }

  const clear = () => {
    tempLayerMap.value = new Map()
  }

  return {
    map: tempLayerMap as Readonly<ShallowRef<Map<TempLayerIndex, Map<string, Layer>>>>,
    set,
    toLayers,
    remove,
    clear,
  }
}
