import type { DialogProps } from 'element-plus'
import type { AnyObject } from '@/shared'

// element-dialog 缺少一些常规属性的类型
export interface GlobalDialogPropsHack extends Omit<Partial<DialogProps>, 'modelValue' | 'value'> {
  class?: string
}

export interface GlobalDialogOptions {
  id: string
  component?: Component
  config: GlobalDialogPropsHack
  props: AnyObject
  listeners: Record<string, (...args: unknown[]) => void>
}

export interface GlobalDialogServiceImpl {
  config: (propsObj: GlobalDialogPropsHack) => GlobalDialogServiceImpl
  props: <T extends AnyObject>(propsObj: T) => GlobalDialogServiceImpl
  listeners: <T extends Record<string, (...args: unknown[]) => void>>(
    listenersObj: T,
  ) => GlobalDialogServiceImpl
  open: (comp: Component) => GlobalDialogControllerImpl
}

export interface GlobalDialogControllerImpl {
  close: <T>(payload?: T) => void
  afterClosed: <T = undefined>() => Promise<T>
  updateProps: (props: AnyObject) => void
}
