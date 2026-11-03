declare namespace DTO {
  /** 订阅的总配置项 */
  interface DadianJSON {
    application?: ApplicationConfig
    editor?: EditorConfig
    plugins?: Record<string, PluginConfig>
    pluginsBeta?: Record<string, PluginConfig>
    tiles?: Record<string, TileConfig>
    tilesBeta?: Record<string, TileConfig>
  }

  type Coordinate2D = [number, number]
  type Coordinate3D = [number, number, number]
  type OverlayBounds = [[xmin: number, ymin: number], [xmax: number, ymax: number]]
  type OverlayRole = 'default' | 'tile'

  /** 头像 */
  interface AvatarOption {
    label?: string
    url?: string
  }

  /** 名片 */
  interface NameCardOption {
    /** 名片大图地址 */
    bg?: string
    /** 名片描述 */
    desc?: string
    /** 名片图标地址 */
    icon?: string
    /** 名片名称 */
    label?: string
    /** 列表条带背景地址 */
    strip?: string
  }

  interface ApplicationConfig {
    avatar?: AvatarOption[]
    nameCard?: NameCardOption[]
  }

  interface EditorConfig {
    /** 用于控制显示的通告内容 */
    bannerText?: string
    /** 用于控制快捷输入中可选的字符 */
    quickInputSnippets?: string[]
    /** 用于提供特殊刷新时间的数据对应 */
    refreshTimeSpecial?: { label: string; value: number }[]
    /** 字体资源 */
    fontResources?: Record<string, { url: string; type: string }>
  }

  interface ExtraConfig {
    '1_6_island'?: {
      stages: {
        /** 阶段选项的标签 */
        label: string
        /** 阶段选项的值 */
        value: string
      }[]
    }
    '2_8_island'?: {
      stages: {
        /** 海岛的名称 */
        label: string
        /** 海岛名称标记值 */
        value: string
        /** 海岛形态选项 */
        children: {
          /** 海岛形态名 */
          label: string
          /** 海岛形态标记值 */
          value: string
        }[]
      }[]
    }
    underground?: {
      /** 开启附加图层选项时的提示文本 */
      textActive?: string
      /** 关闭附加图层选项时的提示文本 */
      textInactive?: string
      /** 是否使用详细的层级信息，如果为 false 则不显示层级选项，且默认设置层级为空 */
      useDetail?: boolean
      /** 层级选项 */
      levels?: {
        /** 层级分组 */
        label: string
        /** 层级分组标记 */
        value: string
        children: {
          /** 层级名称 */
          label: string
          /** 层级标记，为实际绑定到层级上的值 */
          value: string
        }[]
      }[]
    }
  }

  interface OverlayChunkOption {
    label?: string
    value?: string
    url?: string
    bounds?: OverlayBounds
  }

  interface OverlayOption extends OverlayChunkOption {
    /** 图片地址生成模板 */
    urlTemplate?: string
    /** 叠层项分片，通常用于一个叠层图由多张图片构成的情况，可选 */
    chunks?: OverlayChunkOption[]
  }

  interface OverlayGroupOption extends Omit<OverlayOption, 'chunks'> {
    /** 该分组内叠层是否可以同时开启 */
    multiple?: boolean
    /** 叠层项 */
    children?: OverlayOption[]
    /** overlay 组角色 */
    role?: OverlayRole
  }

  interface OverlayConfig {
    /** 面板折叠后小图标的图标类（仅 Quasar 图标库，暂不通用） */
    panelIcon?: string
    /** 面板折叠后小图标的颜色 */
    panelIconColor?: string
    /**
     * 是否启用暗色遮盖
     * @default false
     */
    overlayMask?: boolean
    /**
     * 是否在有分层层级选中时才进行暗色覆盖
     * @default true
     */
    overlayMaskOnSelected?: boolean
    /**
     * 在暗色遮盖时遮盖部分的透明度，默认值由前端确定
     * @range `0 ~ 1`
     */
    overlayMaskOpacity?: number
    /** 图片地址生成模板 */
    urlTemplate?: string
    /** 生成元素ID的模板 */
    idTemplate?: string
    /** 同一组内叠层是否可以同时开启 */
    multiple?: boolean
    /** 叠层分组 */
    overlays?: OverlayGroupOption[]
  }

  interface PluginConfig {
    /** 开启的 extra 插件 */
    extra?: keyof ExtraConfig
    /** extra 插件具体配置 */
    extraConfig?: ExtraConfig
    /** 是否启用叠层 */
    overlay?: boolean
    overlayConfig?: OverlayConfig
  }

  interface TileConfig {
    /** 区域代码，用以拼接图片 URL 用，必填 */
    code?: string
    /** 底图名字，用以使用于地区切换 */
    name?: string
    /**
     * 继承其他配置，将当前配置与此值表示的配置项合并后的配置作为此项的配置项
     * @note 仅支持一层继承
     */
    extend?: string
    /**
     * 坐标系原点所在位置（相对于 tile 定位坐标本身）
     */
    center?: DTO.Coordinate2D
    /** 文件扩展名 */
    extension?: string
    /** 地图图片的总宽高（像素） */
    size?: DTO.Coordinate2D
    /**
     * Leaflet.js <Map options> 的配置
     * @note 在新后台中用作初始化视口配置
     */
    settings?: {
      center?: DTO.Coordinate2D
      zoom?: number
    }
    /** 瓦片偏移量（像素） */
    tilesOffset?: DTO.Coordinate2D
  }

  interface MarkerExtra {
    /** 非地面区域 */
    underground?: {
      is_underground?: boolean
      is_global?: boolean
      region_levels?: string[]
    } | null

    /** 1.6 海岛数据 */
    '1_6_island'?: string[]

    /** 2.8 海岛数据 */
    '2_8_island'?: {
      island_name?: string
      island_state?: string[]
    }

    /** 覆盖图标 */
    iconOverride?: {
      /** `icon.id` */
      id?: number
      /** 最小可见缩放级别，大于该值可见 */
      minZoom?: number
      /** 最大可见缩放级别，小于该值可见 */
      maxZoom?: number
    } | null

    /**
     * 洞口关联
     * @deprecated
     */
    caves?: number[]
  }
}
