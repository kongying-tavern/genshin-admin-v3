import type { Editor } from '@tiptap/core'

export interface HeaderConfig {
  headerMin?: number
  headerMax?: number
  headers?: number[]
}

export interface EditorConfig {
  defaultForeground?: string
  defaultBackground?: string
  viewFont?: string
  viewZoom?: number
  viewLineHeight?: number
  scrollbarColor?: string
  scrollbarWidth?: string
  scrollbarThumbColor?: string
}

export type EditorProps = EditorConfig
  & HeaderConfig & {
    contentHeight?: number
    sizeRatio?: number
    baseTextSize: number
    readonly?: boolean
  }

export interface HeaderToolbarProps extends HeaderConfig {
  editor: Editor
  baseSize?: number
}
