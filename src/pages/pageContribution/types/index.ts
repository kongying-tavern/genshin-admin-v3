import type { SysUserSmallVo } from '@/api/alova/globals'

export interface TransformedScore {
  user: SysUserSmallVo & {
    id: number
  }
  count: number
  maxFields: number
  fields: { key: string; label: string; value: number }[]
  chars: {
    markerTitleChars: number
    contentChars: number
  }
}

export interface SheetableData {
  // user info
  userId: number
  nickname?: string
  // local data
  markerCreation: number
  // chars
  markerTitleChars: number
  contentChars: number
  // fields
  markerTitle: number
  content: number
  extra: number
  hiddenFlag: number
  picture: number
  position: number
  refreshTime: number
}
