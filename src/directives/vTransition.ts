import type { ObjectDirective } from 'vue'

type Modifiers = string
type IsTransitioning = boolean
type PropertyNames = string

const controllerRefs = new Map<string, AbortController>()

export const vTransition: ObjectDirective<HTMLElement, IsTransitioning, Modifiers, PropertyNames> =
  {
    mounted: (el, binding) => {
      const { arg: propertyName } = binding
      if (!propertyName) return

      const controller = new AbortController()

      el.addEventListener(
        'transitionstart',
        ev => {
          if (ev.propertyName !== propertyName) return
          binding.value = true
        },
        { signal: controller.signal },
      )

      el.addEventListener(
        'transitionend',
        ev => {
          if (ev.propertyName !== propertyName) return
          binding.value = false
        },
        { signal: controller.signal },
      )

      const id = crypto.randomUUID()
      el.dataset.trHookId = id
      controllerRefs.set(id, controller)
    },

    beforeUnmount: el => {
      const { trHookId } = el.dataset
      if (!trHookId) return
      controllerRefs.get(trHookId)?.abort()
      controllerRefs.delete(trHookId)
    },
  }
