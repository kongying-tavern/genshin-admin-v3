import type { InjectionKey, Ref } from 'vue'

export const addonPanelRefKey = Symbol('addon-panel') as InjectionKey<
  Ref<HTMLDivElement | undefined>
>
