import type { FilterPreset, FilterType, MAFGroup } from '.'
import type { ManagerModule } from '@/shared'

/**
 * ### 用户首选项
 * #### 除基本信息外，索引必须遵守命名格式
 * ```
 * `${namespace}.${type}.${key}`
 * `map.setting.overlayVisible`
 * ```
 *
 * #### 快捷键必须遵守以下命名格式
 * ```
 * `${namespace}.shortcutKey.${key}`
 * `app.shortcutKey.toggleDarkMode`
 * ```
 */
export interface UserPreference {
  // ====================     base     ====================

  /** 用户 id */
  id?: number

  // ====================     app      ====================

  /** 开关黑暗模式的快捷键 */
  'app.shortcutKey.toggleDarkMode': string

  /** 多选点位的快捷键 */
  'app.shortcutKey.multiselectMarker': string

  /** 批量修改点位标记状态的快捷键 */
  'app.shortcutKey.toggleMarkerState': string

  /** 移动点位的快捷键 */
  'app.shortcutKey.draggingMarker': string

  // ====================      外观      ====================

  /** 字体资源名称。空字符串表示使用默认字体 */
  'appearance.setting.mapLabelFont'?: string
  'appearance.setting.genshinFont'?: string
  'appearance.setting.elementFont'?: string
  'appearance.setting.markerDescriptionFont'?: string
  'appearance.setting.noticeEditorFont'?: string

  // ====================    用户中心    ====================

  /** 用户名片 */
  'userCenter.setting.nameCard'?: string

  /** 是否显示限定地区 */
  'userCenter.setting.showRestrictedArea'?: boolean

  // ====================      公告      ====================

  /**
   * 公告的排序规则
   * @note 公告的阅读记录与弹窗时间已移至独立的本地存储，见 `NOTICE_STATE_KEY`
   */
  'notice.setting.sort'?: string[]

  // ====================      地图      ====================

  /** 显示区域名称标签 */
  'map.setting.showZoneTag': boolean

  /** 在地图上显示跟随指针的全幅十字线和坐标 */
  'map.setting.showFullCrosshair': boolean

  /** 在新增点位的罗盘旁显示选址小地图 */
  'map.setting.showPlacementMinimap'?: boolean

  /** 将新增点位的瞄准环锁定在地图坐标上 */
  'map.setting.lockPlacementReticle'?: boolean

  /** 透明化状态为已完成的点位 */
  'map.setting.transparentMarked': boolean

  /** 性能优化：是否在视图更新时禁用点位拾取 */
  'map.setting.pauseViewChangingPicking'?: boolean

  /** 隐藏点位弹窗 */
  'map.setting.hideMarkerPopover'?: boolean

  /** 打开点位弹窗和筛选时在线核对点位 */
  'map.setting.verifyMarkersOnline'?: boolean

  /** 地图缩放时的过渡时间 */
  'map.setting.zoomTransitionDuration': number

  /** 地图最后停留的中心点位置 @todo 保留，可能有性能问题 */
  'map.viewState.target'?: DTO.Coordinate2D

  /** 显示附加图层 */
  'map.state.showOverlay'?: boolean

  // ====================      管理      ====================

  /** 分页列表，每页项目数设置 */
  'manager.setting.pageSize'?: [ManagerModule, number][]

  /** 点位移动时可以同时编辑的数量，未填或为 0 时表示不限制 */
  'manager.setting.markerDraggingCount'?: number

  // ====================     数据库     ====================

  /** 数据库全量更新间隔（毫秒） */
  'database.setting.updateTimeGap'?: number

  // ====================   地图侧边栏   ====================

  /** 侧边栏折叠状态 */
  'mapSiderMenu.state.collapse': boolean

  /** 侧边栏当前激活的 tab */
  'mapSiderMenu.state.tabName': string

  // ====================      点位      ====================

  /** 筛选器存储的预设 */
  'markerFilter.setting.presets'?: FilterPreset[]

  /** 筛选器自动跳转下一步 */
  'markerFilter.setting.autoNext': boolean

  /** 筛选器筛选类型 */
  'markerFilter.setting.filterType': FilterType

  /** 筛选器选择的Tab */
  'markerFilter.state.step': number

  /** 筛选器选择的父级地区 */
  'markerFilter.state.parentAreaCode': string

  /** 筛选器选择的子级地区 */
  'markerFilter.state.areaCode': string

  /** 筛选器选择的分类 */
  'markerFilter.state.itemTypeId'?: number

  /** 筛选器选择的物品 */
  'markerFilter.state.itemIds'?: number[]

  /** 正在标记的物品 id */
  'markerFilter.state.defaultMarkingItemId'?: number

  /** 高级筛选器缓存 */
  'markerFilter.filter.advancedFilterCache': MAFGroup[]

  /** 高级筛选器配置 */
  'markerFilter.filter.advancedFilter': MAFGroup[]

  // ====================     设置面板     ====================

  /** 设置面板当前激活的设置项 */
  'settingPanel.state.activedKey': string

  // ====================      socket      ====================

  /** 允许在接收 web socket 事件时通知用户 */
  'socket.setting.enableNotice'?: boolean

  /** 允许弹出通知的 web socket 事件 */
  'socket.setting.noticeEvents'?: WebSocketAPI.WSEventType[]

  // ====================      开发者      ====================

  /**
   * 可见日志
   * @note 此项设置的 undefined 值作为第三种状态被使用，请勿初始化
   */
  'developer.setting.enableLoggers'?: string[]

  /**
   * 本地缓存日志的最大数量
   * @default 100
   */
  'developer.setting.maxLogs'?: number
}

export const getDefaultPreference = (): UserPreference => ({
  'app.shortcutKey.toggleDarkMode': 'control_alt_t',
  'app.shortcutKey.multiselectMarker': 'control_alt_a',
  'app.shortcutKey.toggleMarkerState': 'control_alt_s',
  'app.shortcutKey.draggingMarker': 'control_alt_d',

  // map
  'map.setting.showZoneTag': true,
  'map.setting.showFullCrosshair': false,
  'map.setting.showPlacementMinimap': false,
  'map.setting.lockPlacementReticle': false,
  'map.setting.transparentMarked': true,
  'map.setting.verifyMarkersOnline': false,
  'map.setting.zoomTransitionDuration': 66,

  // mapSiderMenu
  'mapSiderMenu.state.tabName': 'filter',
  'mapSiderMenu.state.collapse': false,

  // markerFilter
  'markerFilter.filter.advancedFilterCache': [
    {
      key: crypto.randomUUID(),
      operator: true,
      opposite: false,
      children: [],
    },
  ],
  'markerFilter.filter.advancedFilter': [
    {
      key: crypto.randomUUID(),
      operator: true,
      opposite: false,
      children: [],
    },
  ],
  'markerFilter.state.step': 0,
  'markerFilter.state.parentAreaCode': 'C:FD',
  'markerFilter.state.areaCode': 'A:FD:FENGDAN',
  'markerFilter.setting.autoNext': true,
  'markerFilter.setting.filterType': 'basic',
  'markerFilter.setting.presets': [],

  // settingPanel
  'settingPanel.state.activedKey': 'dashboard',

  // socket
  'socket.setting.enableNotice': true,
  'socket.setting.noticeEvents': ['UserKickedOut'],
})
