export interface MapConfigFragment {
  label: string
  path: string
  value: unknown
  sources?: string[]
}

export interface MapConfigField {
  label: string
  value: unknown
  sources: string[]
}

export interface MapConfigOverlay {
  id: string
  label: string
  role: DTO.OverlayRole
  multiple: boolean
  markerBounds?: DTO.OverlayBounds
  mapBounds?: DTO.OverlayBounds
  boundsMessage?: string
  boundsSources?: string[]
  children: MapConfigOverlay[]
}

export interface MapConfigArea {
  code: string
  name: string
  fields: MapConfigField[]
  origin: DTO.Coordinate2D
  viewport: DTO.Coordinate2D
  bounds?: DTO.OverlayBounds
  overlayEnabled: boolean
  overlays: MapConfigOverlay[]
  plugins: MapConfigFragment[]
  fragments: MapConfigFragment[]
}

export interface MapConfigResourceEntry extends MapConfigFragment {
  image?: string
}

export interface MapConfigResourceCategory {
  key: string
  label: string
  entries: MapConfigResourceEntry[]
  present: boolean
}

export interface MapConfigResourceGroup {
  key: 'application' | 'editor'
  label: string
  categories: MapConfigResourceCategory[]
}

export interface MapConfigViewerModel {
  digest: string
  version: string
  loading: boolean
  areasLoading?: boolean
  hasBeta: boolean
  areas: MapConfigArea[]
  resources: MapConfigResourceGroup[]
}

const arrayCategory = <T>(
  key: string,
  label: string,
  values: T[] | undefined,
  getLabel: (value: T) => string | undefined,
  getImage?: (value: T) => string | undefined,
): MapConfigResourceCategory => ({
  key,
  label,
  present: values !== undefined,
  entries:
    values?.map((value, index) => ({
      label: getLabel(value) || `${label} ${index + 1}`,
      path: `${key}[${index}]`,
      value,
      image: getImage?.(value),
    })) ?? [],
})

export const getMapConfigResources = ({
  application,
  editor,
}: DTO.DadianJSON): MapConfigResourceGroup[] => [
  {
    key: 'application',
    label: '应用资源',
    categories: [
      arrayCategory(
        'application.avatar',
        '头像',
        application?.avatar,
        avatar => avatar.label,
        avatar => avatar.url,
      ),
      arrayCategory(
        'application.nameCard',
        '名片',
        application?.nameCard,
        card => card.label,
        card => card.icon || card.strip || card.bg,
      ),
    ],
  },
  {
    key: 'editor',
    label: '编辑器资源',
    categories: [
      {
        key: 'editor.fontResources',
        label: '字体',
        present: editor?.fontResources !== undefined,
        entries: Object.entries(editor?.fontResources ?? {}).map(([family, value]) => ({
          label: family,
          path: `editor.fontResources[${JSON.stringify(family)}]`,
          value,
        })),
      },
      arrayCategory(
        'editor.quickInputSnippets',
        '快捷输入',
        editor?.quickInputSnippets,
        text => text,
      ),
      arrayCategory(
        'editor.refreshTimeSpecial',
        '特殊刷新时间',
        editor?.refreshTimeSpecial,
        time => time.label,
      ),
      {
        key: 'editor.bannerText',
        label: '公告文本',
        present: editor?.bannerText !== undefined,
        entries: editor?.bannerText?.trim()
          ? [{ label: '公告文本', path: 'editor.bannerText', value: editor.bannerText }]
          : [],
      },
    ],
  },
]
