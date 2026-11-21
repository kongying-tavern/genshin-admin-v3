import type { ItemVo, MarkerVo } from '@/api/alova/globals'
import type { GlobalDialogControllerImpl } from '@/components/AppDialog'
import { GlobalDialogService, getGlobalDialogState } from '@/components/AppDialog'
import { MapAiError } from '@/ai/errors'
import {
  useAccessStore,
  useItemStore,
  useMapStateStore,
  usePreferenceStore,
  useUserStore,
} from '@/stores'
import MarkerCreator from './MarkerCreator.vue'
import MarkerEditor from './MarkerEditor.vue'

export type MarkerDialogKind = 'editor' | 'creator'

interface MarkerDialogSession {
  id: string
  kind: MarkerDialogKind
  controller: GlobalDialogControllerImpl
  markerId?: number
  markerTitle?: string
  cleanup: () => void
}

let session: MarkerDialogSession | undefined

export interface OpenMarkerDialogResult {
  id: string
  opened: boolean
  queued: boolean
  markerId?: number
}

export interface MarkerDialogState {
  open: boolean
  queued: boolean
  kind?: MarkerDialogKind
  markerId?: number
  markerTitle?: string
}

const resetSession = (targetId: string) => {
  if (session?.id !== targetId) return
  session.cleanup()
  session = undefined
}

const assertLogin = () => {
  if (!useUserStore().info) {
    throw new MapAiError('E_FORBIDDEN', '请先登录后再操作点位表单')
  }
}

/** 打开点位编辑弹窗（调用方负责先拉取完整 MarkerVo） */
export const openMarkerEditorDialog = (marker: MarkerVo): OpenMarkerDialogResult => {
  assertLogin()
  if (!useAccessStore().get('MARKER_EDIT')) {
    throw new MapAiError('E_FORBIDDEN', '当前账号没有点位编辑权限')
  }
  if (marker.id === undefined) {
    throw new MapAiError('E_NOT_FOUND', '点位 id 为空')
  }

  const state = getGlobalDialogState()
  if (session) {
    const active = state.currentId === session.id || state.queuedIds.includes(session.id)
    if (active && session.kind === 'editor' && session.markerId === marker.id) {
      return {
        id: session.id,
        opened: state.currentId === session.id,
        queued: state.currentId !== session.id,
        markerId: marker.id,
      }
    }
    if (active) {
      throw new MapAiError('E_BUSY', '已有点位表单正在打开，请先关闭')
    }
    resetSession(session.id)
  }

  const mapStateStore = useMapStateStore()
  const { isEnable, isProcessing, update, clear } = mapStateStore.subscribeMission(
    'markerEditting',
    () => undefined,
  )
  if (!isEnable.value) {
    throw new MapAiError('E_UNAVAILABLE', '当前存在地图任务，无法编辑点位')
  }

  update(marker.id)

  const service = new GlobalDialogService()
  let controller: GlobalDialogControllerImpl
  try {
    controller = service
      .config({
        width: 'fit-content',
        alignCenter: true,
        showClose: false,
        closeOnClickModal: false,
        closeOnPressEscape: false,
      })
      .props({ markerInfo: marker })
      .open(MarkerEditor)
  } catch (error) {
    if (isProcessing.value) clear()
    throw error
  }

  const id = service._getId()
  const cleanup = () => {
    if (isProcessing.value) clear()
  }
  session = {
    id,
    kind: 'editor',
    controller,
    markerId: marker.id,
    markerTitle: marker.markerTitle,
    cleanup,
  }
  void controller.afterClosed().finally(() => resetSession(id))

  return {
    id,
    opened: getGlobalDialogState().currentId === id,
    queued:
      getGlobalDialogState().currentId !== undefined && getGlobalDialogState().currentId !== id,
    markerId: marker.id,
  }
}

/** 打开点位新增弹窗（坐标应已转换为点位坐标系） */
export const openMarkerCreatorDialog = (
  coordinate: DTO.Coordinate2D,
  defaultItem?: ItemVo,
): OpenMarkerDialogResult => {
  assertLogin()
  if (!useAccessStore().get('MARKER_CREATE')) {
    throw new MapAiError('E_FORBIDDEN', '当前账号没有点位新增权限')
  }
  if (useMapStateStore().mission) {
    throw new MapAiError('E_UNAVAILABLE', '当前存在地图任务，无法新增点位')
  }

  const state = getGlobalDialogState()
  if (session) {
    const active = state.currentId === session.id || state.queuedIds.includes(session.id)
    if (active) throw new MapAiError('E_BUSY', '已有点位表单正在打开，请先关闭')
    resetSession(session.id)
  }

  const service = new GlobalDialogService()
  const controller = service
    .config({
      width: 'fit-content',
      alignCenter: true,
      showClose: false,
      closeOnClickModal: false,
      closeOnPressEscape: false,
    })
    .props({ coordinate, defaultItem })
    .open(MarkerCreator)

  const id = service._getId()
  session = {
    id,
    kind: 'creator',
    controller,
    cleanup: () => {},
  }
  void controller.afterClosed().finally(() => resetSession(id))

  return {
    id,
    opened: getGlobalDialogState().currentId === id,
    queued:
      getGlobalDialogState().currentId !== undefined && getGlobalDialogState().currentId !== id,
  }
}

/** 关闭当前点位弹窗 */
export const closeMarkerDialog = (kind?: MarkerDialogKind): { closed: boolean } => {
  if (!session) return { closed: false }
  if (kind && session.kind !== kind) return { closed: false }
  const state = getGlobalDialogState()
  const queued = state.queuedIds.includes(session.id)
  const id = session.id
  session.controller.close()
  if (queued) resetSession(id)
  return { closed: true }
}

/** 读取点位弹窗状态 */
export const getMarkerDialogState = (kind: MarkerDialogKind): MarkerDialogState => {
  if (!session || session.kind !== kind) {
    return { open: false, queued: false }
  }
  const state = getGlobalDialogState()
  return {
    open: state.currentId === session.id,
    queued: state.queuedIds.includes(session.id),
    kind: session.kind,
    ...(session.markerId === undefined ? {} : { markerId: session.markerId }),
    ...(session.markerTitle === undefined ? {} : { markerTitle: session.markerTitle }),
  }
}

/** 当前激活的点位表单类型 */
export const getActiveMarkerDialogKind = (): MarkerDialogKind | undefined => session?.kind

/** 根据 id 读取默认新增点位物品 */
export const resolveDefaultMarkingItem = (itemId?: number): ItemVo | undefined => {
  const preferenceStore = usePreferenceStore()
  const targetId = itemId ?? preferenceStore.defaultMarkingItemId
  if (targetId === undefined || targetId < 0) return undefined
  const item = useItemStore().itemIdMap.get(targetId)
  if (!item) {
    throw new MapAiError('E_NOT_FOUND', `物品 ${targetId} 不存在`)
  }
  return item
}
