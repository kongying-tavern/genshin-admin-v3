import type { ComputedRef, InjectionKey } from 'vue'
import type { ElDropdown } from 'element-plus'

interface WindowPopup {
  target: ComputedRef<HTMLElement | undefined>
  bodyClass: ComputedRef<string | undefined>
  active: ComputedRef<boolean>
}

export const windowPopupKey: InjectionKey<WindowPopup> = Symbol('windowPopup')

export const useWindowPopupTarget = () => inject(windowPopupKey, null)?.target

/** Element Plus 的 Dropdown 只支持原地渲染或传送到全局。 */
export const useWindowDropdown = (refName: string) => {
  const owner = inject(windowPopupKey, null)
  const dropdown = useTemplateRef<InstanceType<typeof ElDropdown>>(refName)
  if (owner) {
    watch(owner.active, active => {
      if (!active) dropdown.value?.handleClose()
    })
  }
  return { dropdown, popperClass: owner?.bodyClass }
}
