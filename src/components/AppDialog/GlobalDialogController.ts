import type { GlobalDialogService } from './GlobalDialogService'
import type { GlobalDialogControllerImpl } from './types'
import type { AnyObject } from '@/shared'
import { context } from './context'

/**
 * 弹窗控制器。
 * - 以实例模式调用时，控制的是由弹窗服务打开的弹窗
 * - 以静态模式调用时，控制的是任意的当前弹窗
 */
export class GlobalDialogController implements GlobalDialogControllerImpl {
  #instance: GlobalDialogService

  constructor(instance: GlobalDialogService) {
    this.#instance = instance
  }

  close = <T>(payload?: T) => {
    const id = this.#instance._getId()
    context.close(id, payload)
  }

  /** 等待弹窗关闭后获取数据 */
  afterClosed = <T = undefined>() =>
    new Promise<T>(resolve => {
      const id = this.#instance._getId()
      if (!context.resolves.has(id)) context.resolves.set(id, [])
      context.resolves.get(id)!.push(resolve as (value: unknown) => void)
    })

  updateProps = (props: AnyObject) => {
    if (!context.current.value || context.current.value?.id !== this.#instance._getId()) return
    context.current.value.props = {
      ...context.current.value.props,
      ...props,
    }
  }
}
