/* oxlint-disable typescript/no-explicit-any */
import type { Component } from 'vue'
import type { GlobalDialogOptions, GlobalDialogPropsHack, GlobalDialogServiceImpl } from './types'
import type { AnyObject } from '@/shared'
import { context } from './context'
import { GlobalDialogController } from './GlobalDialogController'

/** 全局弹窗服务，内部调用 */
export class GlobalDialogService implements GlobalDialogServiceImpl {
  #id: string

  #config: GlobalDialogPropsHack = {
    width: 'fit-content',
    showClose: false,
    alignCenter: true,
    closeOnClickModal: false,
    closeOnPressEscape: false,
  }

  #props: AnyObject = {}

  #listeners: Record<string, (...args: any[]) => void> = {}

  #component?: Component

  #reset = () => {
    this.#config = {
      width: 'fit-content',
      showClose: false,
      alignCenter: true,
      closeOnClickModal: false,
      closeOnPressEscape: false,
    }
    this.#props = {}
    this.#listeners = {}
    this.#component = undefined
  }

  constructor() {
    this.#id = crypto.randomUUID()
  }

  _getId = () => {
    return this.#id
  }

  _getOptions = (): GlobalDialogOptions => {
    return {
      id: this.#id,
      config: this.#config,
      props: this.#props,
      listeners: this.#listeners,
      component: this.#component,
    }
  }

  /** 传递给 el-dialog 的属性 */
  config = (configObj: GlobalDialogPropsHack) => {
    this.#config = {
      ...this.#config,
      ...configObj,
    }
    return this
  }

  /** 传递给弹窗默认插槽上的组件的属性 */
  props = <T extends AnyObject>(propsObj: T) => {
    this.#props = {
      ...this.#props,
      ...propsObj,
    }
    return this
  }

  /** 传递给弹窗默认插槽上的组件的事件监听器 */
  listeners = <T extends Record<string, (...args: any[]) => void>>(listenersObj: T) => {
    this.#listeners = {
      ...this.#listeners,
      ...listenersObj,
    }
    return this
  }

  /** 打开弹窗，返回弹窗控制器 */
  open = (comp: Component) => {
    this.#component = comp
    context.open(this)
    const controller = new GlobalDialogController(this)
    controller.afterClosed().then(() => {
      this.#reset()
    })
    return controller
  }
}
