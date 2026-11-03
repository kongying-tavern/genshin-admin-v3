import type { DialogProps } from 'element-plus'
import type { AnyObject } from '@/shared'

// element-dialog 缺少一些常规属性的类型
export interface GlobalDialogPropsHack extends Omit<Partial<DialogProps>, 'modelValue' | 'value'> {
  class?: string
}

/**
 * 单个弹窗事件监听器
 *
 * 形参取 `never` 而非 `any`：`never` 处在参数逆变位置，
 * `() => void`、`(value: string) => void` 等任意具体签名都能赋值给它，
 * 调用方不必为处理器标注入参类型，这里也无需显式 `any`。
 */
export type GlobalDialogListener = (...args: never[]) => void

/**
 * 弹窗事件监听器集合
 *
 * `close` 单独声明：弹窗内部会携带 payload 主动调用它，
 * 若沿用参数为 `never` 的 `GlobalDialogListener`，内部无法传入实参。
 */
export interface GlobalDialogListeners {
  [event: string]: GlobalDialogListener | undefined
  close?: (payload?: unknown) => void
}

export interface GlobalDialogOptions {
  id: string
  component?: Component
  config: GlobalDialogPropsHack
  props: AnyObject
  listeners: GlobalDialogListeners
}

export interface GlobalDialogServiceImpl {
  config: (propsObj: GlobalDialogPropsHack) => GlobalDialogServiceImpl
  props: <T extends AnyObject>(propsObj: T) => GlobalDialogServiceImpl
  listeners: (listenersObj: GlobalDialogListeners) => GlobalDialogServiceImpl
  open: (comp: Component) => GlobalDialogControllerImpl
}

export interface GlobalDialogControllerImpl {
  close: <T>(payload?: T) => void
  afterClosed: <T = undefined>() => Promise<T>
  updateProps: (props: AnyObject) => void
}
