import type { AreaVo } from '@/api/alova/globals'

/**
 * ## 地区附加配置
 * - 用于优化地图渲染或交互体验的，这是一个规范性配置，其作用取决于具体实现。
 * - 此处的配置应当都是可选的，避免强绑定可能带来的问题。
 * @todo 接入用户设置或订阅源
 */
export interface AreaAdditionalConfig {
  /**
   * ### 地区的中心位置
   * - 可用于在点位筛选器中选定地区后会使得视口自动定位到对应的坐标
   * - 该配置可以覆盖来自下发配置中 `tiles[AREA_CODE].settings.center` 的配置
   * @注意 应当使用点位坐标而非地图坐标
   */
  target?: DTO.Coordinate2D

  /**
   * ### 地区的边界坐标点集
   * - 可用于打点时自动选择地区
   * @注意 应当使用点位坐标而非地图坐标
   * @todo 暂未实现
   */
  bounds?: DTO.Coordinate2D[]

  /**
   * ### 地区图标
   * - 可用于存档管理页显示地区图标的回退
   * - 当子级地区未指定时，会使用其父级地区的值
   */
  icon?: string
}

export const AREA_ADDITIONAL_CONFIG_MAP: Record<string, AreaAdditionalConfig> = {
  /** 蒙德 - 父级地区 */
  'C:MD': {
    icon: '/icons/area/蒙德.png',
  },
  /** 蒙德 - 龙脊雪山 */
  'A:MD:XUESHAN': {
    icon: '/icons/area/龙脊雪山.png',
  },

  /** 金苹果群岛 - 父级 */
  'C:APPLE': {
    icon: '/icons/area/金苹果群岛.png',
  },

  /** 璃月 - 父级 */
  'C:LY': {
    icon: '/icons/area/璃月.png',
  },
  /** 璃月 - 层岩 */
  'A:LY:CENGYAN': {
    icon: '/icons/area/层岩巨渊.png',
  },

  /** 稻妻 - 父级 */
  'C:DQ': {
    icon: '/icons/area/稻妻.png',
  },

  /** 须弥 - 父级 */
  'C:XM': {
    icon: '/icons/area/须弥.png',
  },
  /** 须弥 - 大赤沙海 */
  'A:XM:DESERT': {
    icon: '/icons/area/须弥沙漠.png',
  },
  /** 须弥 - 千壑沙地 */
  'A:XM:DESERT2': {
    icon: '/icons/area/须弥沙漠.png',
  },
  /** 须弥 - 苍漠囿土 */
  'A:XM:DESERT3': {
    icon: '/icons/area/须弥沙漠.png',
  },

  /** 流形蜃境 */
  'C:VELURIYAM': {
    icon: '/icons/area/流形蜃境.png',
  },

  /** 枫丹 - 父级 */
  'C:FD': {
    icon: '/icons/area/枫丹.png',
  },

  /** 希穆兰卡 - 父级 */
  'C:SIMULANKA': {
    icon: '/icons/area/希穆兰卡.png',
  },

  /** 纳塔 */
  'C:NT': {},

  /** 挪德卡莱 */
  'C:NDKL': {},
}

/** 使用静态配置中的图标 */
export const fallbackToStaticIcon = (area?: AreaVo) => {
  if (!area) return ''
  const { code } = area
  const { 1: areaTag } = code!.split(':')
  const fallbackIcon =
    AREA_ADDITIONAL_CONFIG_MAP[code!]?.icon ?? AREA_ADDITIONAL_CONFIG_MAP[`C:${areaTag}`]?.icon
  return fallbackIcon
}
