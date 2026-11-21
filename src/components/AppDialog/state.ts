import type { GlobalDialogOptions } from './types'
import type { AnyObject } from '@/shared'
import { context } from './context'

export interface GlobalDialogState {
  visible: boolean
  currentId?: string
  queuedIds: string[]
}

/** 读取全局弹窗状态，供快照/设置 helper 使用 */
export const getGlobalDialogState = (): GlobalDialogState => ({
  visible: context.visible.value,
  ...(context.current.value?.id === undefined ? {} : { currentId: context.current.value.id }),
  queuedIds: context.queue.map(instance => instance._getId()),
})

/**
 * 按 id 关闭弹窗。
 * - 当前弹窗：触发 afterClosed 解析
 * - 排队弹窗：从队列移除（现有 context 不会解析其 afterClosed，调用方需自行清理）
 */
export const closeGlobalDialog = (id: string) => {
  context.close(id, undefined)
}

/** 更新当前弹窗 props；会整体替换 options 以触发 shallowRef */
export const setGlobalDialogProps = (id: string, patch: AnyObject): boolean => {
  const current = context.current.value
  if (!current || current.id !== id) return false
  context.current.value = {
    ...current,
    props: {
      ...current.props,
      ...patch,
    },
  } satisfies GlobalDialogOptions
  return true
}
