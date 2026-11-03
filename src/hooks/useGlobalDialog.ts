import type {
  GlobalDialogControllerImpl,
  GlobalDialogListeners,
  GlobalDialogPropsHack,
} from '@/components'
import type { AnyObject } from '@/shared'
import { GlobalDialogService } from '@/components'

/**
 * ### 获取弹窗服务
 *
 * 适用于以下情况：
 * 1. 简单的弹窗表单
 * 2. 列表项弹窗（降低弹窗组件数量，提高性能）等场景
 *
 * 注意事项：
 * 1. 该服务为单例模式
 * 2. 如果你的弹窗很复杂，请直接使用 `el-dialog`
 */
export const useGlobalDialog = () => {
  const dialog = new GlobalDialogService()

  const controller = shallowRef<GlobalDialogControllerImpl>()

  class DialogService {
    static config = (configObj: GlobalDialogPropsHack) => {
      dialog.config(configObj)
      return this
    }

    static props = (propsObj: AnyObject) => {
      dialog.props(propsObj)
      return this
    }

    static listeners = (listenersObj: GlobalDialogListeners) => {
      dialog.listeners(listenersObj)
      return this
    }

    static open = (comp: Component) => {
      controller.value = dialog.open(comp)
      return controller.value
    }
  }

  tryOnUnmounted(() => {
    controller.value?.close()
  })

  return { DialogService }
}
