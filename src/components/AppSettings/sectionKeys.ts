/** 设置弹窗页签 key，供 UI 与 AI 桥接共享 */
export const SETTING_SECTION_KEYS = [
  'dashboard',
  'appearance',
  'app',
  'mapsetting',
  'manager',
  'database',
  'network',
  'developer',
  'about',
] as const

export type SettingSectionKey = (typeof SETTING_SECTION_KEYS)[number]

export const isSettingSectionKey = (value: unknown): value is SettingSectionKey =>
  typeof value === 'string' && (SETTING_SECTION_KEYS as readonly string[]).includes(value)
