import type { SysUserSmallVo } from '@/api/alova/globals'

export interface UserPopoverHookOptions {
  getUser: (index: number) => SysUserSmallVo
}

export const useUserPopover = (options: UserPopoverHookOptions) => {
  const { getUser } = options

  const triggerRef = shallowRef<HTMLElement | null>(null)
  const userData = shallowRef<SysUserSmallVo | null>(null)

  const IDENTIFICATION_SYMBOL = crypto.randomUUID()

  const getTarget = (ev: Event) => {
    return ev
      .composedPath()
      .find(
        target => target instanceof HTMLElement && target.dataset.symbol === IDENTIFICATION_SYMBOL,
      ) as HTMLElement | undefined
  }

  const trigger = (ev: Event) => {
    const target = getTarget(ev)
    if (!target || target === triggerRef.value) return
    const userId = Number(target.dataset.userId)
    userData.value = getUser(userId)
    triggerRef.value = target
  }

  const close = (ev: Event) => {
    if (!triggerRef.value || !getTarget(ev)) return
    triggerRef.value = null
  }

  return { IDENTIFICATION_SYMBOL, triggerRef, userData, trigger, close }
}
