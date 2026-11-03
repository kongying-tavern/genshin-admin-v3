import { useState } from '@/hooks'

export const useInteractionInfo = () => {
  const isPaused = ref<{
    hover: Partial<Record<string, boolean>>
    focus: Partial<Record<string, boolean>>
  }>({
    hover: {},
    focus: {},
  })

  const hoverElements = ref(new Map<string, Set<unknown>>())
  const focusElements = ref(new Map<string, Set<unknown>>())

  const interactionTimestamp = ref(Date.now())

  const updateTime = () => {
    interactionTimestamp.value = Date.now()
  }

  /** single 为 true 时将会移除其他 type 的此类交互效果 */
  const addInteraction = (interaction: 'focus' | 'hover') => {
    const elements = interaction === 'focus' ? focusElements.value : hoverElements.value
    return <T>(type: string, value: T, single = false) => {
      if (isPaused.value[interaction][type] || value === undefined || value === null) return
      if (single) {
        elements.clear()
        elements.set(type, new Set([value]))
        return updateTime()
      }
      const set = elements.get(type)
      if (!set) {
        elements.set(type, new Set([value]))
        return updateTime()
      }
      if (set.has(value)) return
      set.add(value)
      return updateTime()
    }
  }

  const setInteraction = (interaction: 'focus' | 'hover') => {
    const elements = interaction === 'focus' ? focusElements.value : hoverElements.value
    return <T>(type: string, value: Set<T>) => {
      if (isPaused.value[interaction][type]) return
      elements.set(type, value)
      return updateTime()
    }
  }

  const removeInteraction = (interaction: 'focus' | 'hover') => {
    const elements = interaction === 'focus' ? focusElements.value : hoverElements.value
    return <T>(type: string, value?: T) => {
      if (isPaused.value[interaction][type] || !elements.has(type)) return

      const set = elements.get(type)!
      if (value === undefined) {
        set.clear()
      } else {
        if (!set.has(value)) return
        set.delete(value)
      }

      if (set.size === 0) elements.delete(type)
      return updateTime()
    }
  }

  const clearInteraction = (interaction: 'focus' | 'hover') => {
    const elements = interaction === 'focus' ? focusElements.value : hoverElements.value
    return () => {
      if (elements.size === 0) return
      elements.clear()
      return updateTime()
    }
  }

  const hasInteraction = (interaction: 'focus' | 'hover') => {
    const elements = interaction === 'focus' ? focusElements.value : hoverElements.value
    return (type: string) => {
      return Boolean(elements.get(type)?.size)
    }
  }

  const isInteraction = (interaction: 'focus' | 'hover') => {
    const elements = interaction === 'focus' ? focusElements.value : hoverElements.value
    return <T>(type: string, value: T) => {
      return Boolean(elements.get(type)?.has(value))
    }
  }

  /** 暂停该类型交互的触发 */
  const pauseInteraction = (interaction: 'focus' | 'hover') => {
    return (type: string) => {
      isPaused.value[interaction][type] = true
    }
  }

  /** 重新开始该类型交互的触发 */
  const resumeInteraction = (interaction: 'focus' | 'hover') => {
    return (type: string) => {
      isPaused.value[interaction][type] = false
    }
  }

  const addHover = addInteraction('hover')
  const addFocus = addInteraction('focus')

  const setHover = setInteraction('hover')
  const setFocus = setInteraction('focus')

  const removeHover = removeInteraction('hover')
  const removeFocus = removeInteraction('focus')

  const clearHover = clearInteraction('hover')
  const clearFocus = clearInteraction('focus')

  const isHover = isInteraction('hover')
  const isFocus = isInteraction('focus')

  const hasHover = hasInteraction('hover')
  const hasFocus = hasInteraction('focus')

  const pauseHover = pauseInteraction('hover')
  const pauseFocus = pauseInteraction('focus')

  const resumeHover = resumeInteraction('hover')
  const resumeFocus = resumeInteraction('focus')

  /** 是否在 hover 时触发点位弹窗，启用时 focus 状态将不会触发弹窗 */
  const [isPopoverOnHover, setIsPopoverOnHover] = useState(false)

  return {
    isPopoverOnHover: isPopoverOnHover as Readonly<Ref<boolean>>,
    setIsPopoverOnHover,

    hoverElements: hoverElements as Readonly<Ref<Map<string, Set<unknown>>>>,
    focusElements: focusElements as Readonly<Ref<Map<string, Set<unknown>>>>,
    interactionTimestamp,

    addHover,
    addFocus,
    setHover,
    setFocus,
    removeHover,
    removeFocus,
    clearHover,
    clearFocus,
    isHover,
    isFocus,
    hasHover,
    hasFocus,
    pauseHover,
    pauseFocus,
    resumeHover,
    resumeFocus,
  }
}
