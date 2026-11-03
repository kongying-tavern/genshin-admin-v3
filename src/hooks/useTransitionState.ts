export const useTransitionState = (target: Ref<HTMLElement | null>, checkName: string) => {
  const state = ref(false)

  const isTransitioning = computed(() => state.value)

  useEventListener<TransitionEvent>(target, 'transitionstart', ev => {
    if (ev.propertyName !== checkName) return
    state.value = true
  })

  useEventListener<TransitionEvent>(target, 'transitionend', ev => {
    if (ev.propertyName !== checkName) return
    state.value = false
  })

  return { isTransitioning }
}
