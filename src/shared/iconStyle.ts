/** 图标样式类型枚举 */
export enum IconStyle {
  /** 默认 */
  DEFAULT = 0,
  /** 无边框 */
  NO_BORDER = 1,
  /** @deprecated 弃用，无对应图标 */
  DEPRECATED = 2,
  /** 类神瞳 */
  OCULUS = 3,
}

export interface IconStyleMeta {
  name: string
  description: string
  disabled?: boolean
}

/**
 * iconStyle 用于控制图标在客户端上的显示模式
 */
export const ICON_STYLE_META_MAP = new Map<IconStyle, IconStyleMeta>([
  [
    IconStyle.DEFAULT,
    {
      name: '默认',
      description: '物品图标 + 有边框 + 有对钩 + 图钉定位',
    },
  ],
  [
    IconStyle.NO_BORDER,
    {
      name: '无边框',
      description: '物品图标 + 无边框 + 有对钩 + 中心定位',
    },
  ],
  [
    IconStyle.OCULUS,
    {
      name: '类神瞳',
      description: '特殊图标 + 无边框 + 无对钩 + 中心定位',
    },
  ],
  [
    IconStyle.DEPRECATED,
    {
      name: '--弃用--',
      description: '--弃用--',
      disabled: true,
    },
  ],
])
