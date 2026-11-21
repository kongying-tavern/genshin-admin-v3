/** 侧边栏页签 key */
export const SIDER_TAB_KEYS = ['filter', 'marker-table', 'features'] as const

export type SiderTabKey = (typeof SIDER_TAB_KEYS)[number]

export const isSiderTabKey = (value: unknown): value is SiderTabKey =>
  typeof value === 'string' && (SIDER_TAB_KEYS as readonly string[]).includes(value)
