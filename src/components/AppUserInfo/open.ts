import type { GlobalDialogControllerImpl } from '@/components/AppDialog'
import { GlobalDialogService, getGlobalDialogState } from '@/components/AppDialog'
import { MapAiError } from '@/ai/errors'
import { useUserStore } from '@/stores'
import { AppUserInfo } from '.'

interface UserInfoSession {
  id: string
  controller: GlobalDialogControllerImpl
}

let session: UserInfoSession | undefined

/** 打开用户中心弹窗 */
export const openUserInfoDialog = (): { id: string; opened: boolean } => {
  if (!useUserStore().isLogin) {
    throw new MapAiError('E_FORBIDDEN', '请先登录后再打开用户中心')
  }

  if (session) {
    const state = getGlobalDialogState()
    if (state.currentId === session.id || state.queuedIds.includes(session.id)) {
      return { id: session.id, opened: state.currentId === session.id }
    }
    session = undefined
  }

  const service = new GlobalDialogService()
  const controller = service.open(AppUserInfo)
  const id = service._getId()
  session = { id, controller }
  void controller.afterClosed().then(() => {
    if (session?.id === id) session = undefined
  })

  return { id, opened: getGlobalDialogState().currentId === id }
}

/** 关闭用户中心弹窗 */
export const closeUserInfoDialog = (): { closed: boolean } => {
  if (!session) return { closed: false }
  const state = getGlobalDialogState()
  const queued = state.queuedIds.includes(session.id)
  session.controller.close()
  if (queued) session = undefined
  return { closed: true }
}

/** 读取用户中心弹窗状态 */
export const getUserInfoDialogState = (): { open: boolean; queued: boolean } => {
  const state = getGlobalDialogState()
  return {
    open: Boolean(session && state.currentId === session.id),
    queued: Boolean(session && state.queuedIds.includes(session.id)),
  }
}
