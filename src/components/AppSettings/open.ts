import type { GlobalDialogControllerImpl } from '@/components/AppDialog'
import { GlobalDialogService, getGlobalDialogState } from '@/components/AppDialog'
import { usePreferenceStore } from '@/stores'
import { AppSettings } from '.'
import { isSettingSectionKey } from './sectionKeys'

interface SettingsSession {
  id: string
  controller: GlobalDialogControllerImpl
}

let session: SettingsSession | undefined

export interface OpenSettingsResult {
  id: string
  opened: boolean
  queued: boolean
}

export interface SettingsDialogState {
  open: boolean
  queued: boolean
  section: string
}

/**
 * 打开系统设置弹窗。
 *
 * - 已打开时幂等：仅更新页签并返回现有弹窗
 * - 页签通过 preferenceStore.settingActivedKey 控制，不依赖组件 props
 */
export const openSettingsDialog = (options: { section?: string } = {}): OpenSettingsResult => {
  const preferenceStore = usePreferenceStore()
  if (isSettingSectionKey(options.section)) {
    preferenceStore.settingActivedKey = options.section
  }

  if (session) {
    const state = getGlobalDialogState()
    if (state.currentId === session.id || state.queuedIds.includes(session.id)) {
      return {
        id: session.id,
        opened: state.currentId === session.id,
        queued: state.currentId !== session.id,
      }
    }
    session = undefined
  }

  const service = new GlobalDialogService()
  const controller = service.open(AppSettings)
  const id = service._getId()
  session = { id, controller }
  void controller.afterClosed().then(() => {
    if (session?.id === id) session = undefined
  })

  const state = getGlobalDialogState()
  return {
    id,
    opened: state.currentId === id,
    queued: state.currentId !== undefined && state.currentId !== id,
  }
}

/** 关闭设置弹窗；排队中的弹窗需要手动清理 session */
export const closeSettingsDialog = (): { closed: boolean } => {
  if (!session) return { closed: false }
  const state = getGlobalDialogState()
  const queued = state.queuedIds.includes(session.id)
  session.controller.close()
  if (queued) session = undefined
  return { closed: true }
}

/** 读取设置弹窗状态 */
export const getSettingsDialogState = (): SettingsDialogState => {
  const preferenceStore = usePreferenceStore()
  const state = getGlobalDialogState()
  return {
    open: Boolean(session && state.currentId === session.id),
    queued: Boolean(session && state.queuedIds.includes(session.id)),
    section: preferenceStore.settingActivedKey || 'dashboard',
  }
}
