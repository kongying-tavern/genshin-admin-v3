import type { ShallowRef } from 'vue'

export interface ListBubbleDragHookOptions<T> {
  /** 判断是否将元素丢弃回原条目 */
  isDropback?: (ev: DragEvent, item: T) => boolean
  /** 执行清除气泡元素的方法 */
  onClearBubble?: (item: T) => void
}

export const useListBubbleDrag = <T>(options: ListBubbleDragHookOptions<T>) => {
  const { isDropback, onClearBubble } = options

  const data: ShallowRef<T | null> = shallowRef(null)

  const isDragging = ref<boolean>(false)

  const onDragStart = (_ev: DragEvent, item: T) => {
    data.value = item
    isDragging.value = true
  }

  const onDragEnd = (_ev: DragEvent) => {
    if (!data.value) {
      isDragging.value = false
      return
    }
    onClearBubble && onClearBubble(data.value)
    data.value = null
    isDragging.value = false
  }

  const onDrop = (ev: DragEvent) => {
    if (!data.value) return
    if (isDropback) {
      if (!isDropback(ev, data.value)) onClearBubble && onClearBubble(data.value)
    } else {
      onClearBubble && onClearBubble(data.value)
    }
    data.value = null
  }

  return {
    isDragging,
    onDragStart,
    onDragEnd,
    onDrop,
  }
}
