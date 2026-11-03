import { useUserStore } from '@/stores'

/** 角色变更事件负载 */
export interface RoleChangePayload {
  oldRoleId?: number
  newRoleId?: number
}

/** 全局角色变更事件总线 */
export const roleChangeHook = createEventHook<RoleChangePayload>()

/** 订阅角色变更事件（仿 onUserLogout） */
export const onRoleChange = (fn: (payload: RoleChangePayload) => void) => {
  tryOnUnmounted(() => {
    roleChangeHook.off(fn)
  })
  return roleChangeHook.on(fn)
}

interface UseRoleWatchOptions {
  /** 轮询间隔(ms)，默认 5 分钟 */
  interval?: number
}

/**
 * 启动角色轮询监听。在 App 级调用一次。
 * - 5 分钟低频轮询 `refreshUserInfo` 并对比 roleId
 * - 页面切回前台(`visibilitychange`)时立即检查
 * - 仅登录时轮询
 */
export const useRoleWatch = (options: UseRoleWatchOptions = {}) => {
  const { interval = 5 * 60 * 1000 } = options
  const userStore = useUserStore()

  // 上一次探测到的 roleId
  let prevRoleId: number | undefined

  const check = async () => {
    if (!userStore.isLogin) return
    await userStore.refreshUserInfo()
    const newRoleId = userStore.info?.roleId
    // 仅当新旧角色都存在且不同时才触发变更事件
    // 排除「从登出态（无角色）恢复登录」和「角色变为空」等非典型场景
    if (prevRoleId !== undefined && newRoleId !== undefined && prevRoleId !== newRoleId) {
      roleChangeHook.trigger({ oldRoleId: prevRoleId, newRoleId })
    }
    prevRoleId = newRoleId
  }

  // 5 分钟轮询
  const { isActive, pause, resume } = useTimeoutPoll(check, interval, { immediate: false })

  // 页面切回前台立即检查
  const visibility = useDocumentVisibility()
  watch(visibility, v => {
    if (v === 'visible') check()
  })

  // 登录状态控制轮询启停；登录后锚定初始 roleId，避免误触发
  watch(
    () => userStore.isLogin,
    login => {
      if (login) {
        prevRoleId = userStore.info?.roleId
        resume()
      } else {
        prevRoleId = undefined
        pause()
      }
    },
    { immediate: true },
  )

  return { isActive, pause, resume }
}
