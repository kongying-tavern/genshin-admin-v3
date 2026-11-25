import type { MarkerVo } from '@/api/alova/globals'
import type { SurfaceDefinition } from '@/ai/types'
import Apis from '@/api/alova'
import { registerCapability } from '@/ai/bindings'
import { fail } from '@/ai/errors'
import {
  closeSettingsDialog,
  getSettingsDialogState,
  openSettingsDialog,
} from '@/components/AppSettings/open'
import { SETTING_SECTION_KEYS } from '@/components/AppSettings/sectionKeys'
import {
  closeUserInfoDialog,
  getUserInfoDialogState,
  openUserInfoDialog,
} from '@/components/AppUserInfo/open'
import { noticeContext } from '@/components/AppNotice/context'
import {
  closeMarkerDialog,
  getMarkerDialogState,
  openMarkerCreatorDialog,
  openMarkerEditorDialog,
  resolveDefaultMarkingItem,
} from '@/components/MarkerModifyer/actions'
import { useAccessStore } from '@/stores/access'
import { useNoticeStore } from '@/stores/notice'
import { useTileStore } from '@/stores/tile'
import { useUserStore } from '@/stores/user'
import { toValue } from 'vue'

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const toMarkerId = (params: unknown): number => {
  const raw = asRecord(params).markerId
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) {
    fail('E_INVALID_PARAMS', 'markerId 必须是正整数')
  }
  return id
}

const toCoordinate = (params: unknown, space: 'marker' | 'map'): DTO.Coordinate2D => {
  const raw = asRecord(params).coordinate
  if (!Array.isArray(raw) || raw.length !== 2) {
    fail('E_INVALID_PARAMS', 'coordinate 必须是 [x, y]')
  }
  const x = Number(raw[0])
  const y = Number(raw[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    fail('E_INVALID_PARAMS', 'coordinate 必须是两个有限数字')
  }
  if (space === 'map') return useTileStore().toMarkerCoordinate([x, y])
  return [x, y]
}

const markerEditorCapability: SurfaceDefinition = {
  id: 'markerEditor',
  kind: 'dialog',
  title: '点位编辑表单',
  description: '按 markerId 拉取完整点位并打开编辑弹窗，可配合 forms.get/set/submit 使用',
  enabled: () => useAccessStore().get('MARKER_EDIT'),
  open: async params => {
    if (!useUserStore().info) fail('E_FORBIDDEN', '请先登录后再编辑点位')
    const markerId = toMarkerId(params)
    const { data = [] } = await Apis.marker.listMarkerById({
      data: { markerIdList: [markerId] },
    })
    const marker = data[0] as MarkerVo | undefined
    if (!marker) fail('E_NOT_FOUND', `点位不存在：${markerId}`)
    return openMarkerEditorDialog(marker)
  },
  close: () => closeMarkerDialog('editor'),
  getState: () => getMarkerDialogState('editor'),
}

const markerCreatorCapability: SurfaceDefinition = {
  id: 'markerCreator',
  kind: 'dialog',
  title: '点位新增表单',
  description:
    '打开新增点位弹窗；coordinate 默认是点位坐标，space=map 时按地图坐标转换，可配合 forms.get/set/submit 使用',
  enabled: () => useAccessStore().get('MARKER_CREATE'),
  open: params => {
    if (!useUserStore().info) fail('E_FORBIDDEN', '请先登录后再新增点位')
    const record = asRecord(params)
    const space = record.space === 'map' ? 'map' : 'marker'
    const coordinate = toCoordinate(params, space)
    const defaultItem =
      record.defaultItemId === undefined
        ? resolveDefaultMarkingItem()
        : resolveDefaultMarkingItem(Number(record.defaultItemId))
    return openMarkerCreatorDialog(coordinate, defaultItem)
  },
  close: () => closeMarkerDialog('creator'),
  getState: () => getMarkerDialogState('creator'),
}

const settingsCapability: SurfaceDefinition = {
  id: 'settings',
  kind: 'dialog',
  title: '系统设置',
  description: `打开设置弹窗，可通过 section 定位到 ${SETTING_SECTION_KEYS.join('/')}`,
  open: params => openSettingsDialog({ section: asRecord(params).section as string | undefined }),
  close: () => closeSettingsDialog(),
  getState: () => getSettingsDialogState(),
}

const userInfoCapability: SurfaceDefinition = {
  id: 'userInfo',
  kind: 'dialog',
  title: '用户中心',
  description: '打开用户中心（云存档 / 编辑信息 / 修改密码）',
  enabled: () => useUserStore().isLogin,
  open: () => openUserInfoDialog(),
  close: () => closeUserInfoDialog(),
  getState: () => getUserInfoDialogState(),
}

const noticesCapability: SurfaceDefinition = {
  id: 'notices',
  kind: 'dialog',
  title: '公告弹窗',
  description: '打开/关闭公告弹窗',
  open: () => useNoticeStore().show(),
  close: () => useNoticeStore().close(),
  getState: () => {
    const noticeStore = useNoticeStore()
    return {
      open: Boolean(toValue(noticeContext.visible)),
      unread: noticeStore.newCount,
      total: (toValue(noticeStore.noticeList) as unknown[]).length,
    }
  },
}

/** 注册静态页面句柄（设置/用户中心/公告/点位表单） */
export const registerStaticCapabilities = (): (() => void) => {
  const unbinds = [
    registerCapability(settingsCapability),
    registerCapability(userInfoCapability),
    registerCapability(noticesCapability),
    registerCapability(markerEditorCapability),
    registerCapability(markerCreatorCapability),
  ]
  return () => unbinds.forEach(unbind => unbind())
}
