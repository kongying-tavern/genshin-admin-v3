import type { Component } from 'vue'
import type { ACCESS_BINARY_MASK } from '@/stores'
import * as ElIcons from '@element-plus/icons-vue'
import { defineAsyncComponent } from 'vue'
import { IconInvitation } from '@/components/AppIcons'

export interface ManagerWindowOption {
  /** 稳定 key，用于生成 `window.<key>` 句柄 */
  key: string
  name: string
  icon: Component
  comp: Component
  role: keyof typeof ACCESS_BINARY_MASK
}

/** 系统管理窗口定义（UI 与 AI 句柄共享） */
export const MANAGER_WINDOW_OPTIONS: ManagerWindowOption[] = [
  {
    key: 'itemManager',
    name: '物品管理',
    icon: ElIcons.Box,
    comp: defineAsyncComponent(() => import('@/pages/pageItemManager/ItemManager.vue')),
    role: 'MANAGER_COMPONENT',
  },
  {
    key: 'areaManager',
    name: '地区管理',
    icon: ElIcons.Coordinate,
    comp: defineAsyncComponent(() => import('@/pages/pageAreaManager/AreaManager.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    key: 'markerManager',
    name: '点位管理',
    icon: ElIcons.Location,
    comp: defineAsyncComponent(() => import('@/pages/pageMarkerManager/MarkerManager.vue')),
    role: 'MANAGER_COMPONENT',
  },
  {
    key: 'typeManager',
    name: '类型管理',
    icon: ElIcons.FolderOpened,
    comp: defineAsyncComponent(() => import('@/pages/pageTypeManager/TypeManager.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    key: 'iconManager',
    name: '图标管理',
    icon: ElIcons.Picture,
    comp: defineAsyncComponent(() => import('@/pages/pageIconManager/IconManager.vue')),
    role: 'MANAGER_COMPONENT',
  },
  {
    key: 'noticeManager',
    name: '公告管理',
    icon: ElIcons.ChatLineRound,
    comp: defineAsyncComponent(() => import('@/pages/pageNoticeManager/PageNoticeManager.vue')),
    role: 'MANAGER_COMPONENT',
  },
  {
    key: 'contribution',
    name: '用户统计',
    icon: ElIcons.Star,
    comp: defineAsyncComponent(() => import('@/pages/pageContribution/PageContribution.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    key: 'userManager',
    name: '用户管理',
    icon: ElIcons.User,
    comp: defineAsyncComponent(() => import('@/pages/pageUserManager/UserManager.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    key: 'invitationManager',
    name: '用户邀请',
    icon: IconInvitation,
    comp: defineAsyncComponent(() => import('@/pages/invitationManager/InvitationManager.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    key: 'history',
    name: '历史记录',
    icon: ElIcons.Memo,
    comp: defineAsyncComponent(() => import('@/pages/pageHistory/PageHistory.vue')),
    role: 'MANAGER_COMPONENT',
  },
]

/** 用户手册窗口（不属于系统管理网格，但同样以窗口形式存在） */
export const USER_MANUAL_WINDOW: ManagerWindowOption = {
  key: 'userManual',
  name: '用户手册',
  icon: ElIcons.Reading,
  comp: defineAsyncComponent(() => import('@/pages/document/PageDocument.vue')),
  role: 'NORMAL_COMPONENT',
}
