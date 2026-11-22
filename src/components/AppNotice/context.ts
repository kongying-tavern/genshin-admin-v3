import type { EventHook } from '@vueuse/core'

export interface NoticeContext {
  dialogRef: Ref<HTMLDialogElement | null>
  visible: Ref<boolean>
  closeHook: EventHook<string | undefined>
  show: () => void
  close: (returnValue?: string) => void
  syncClosed: () => void
}

const finishClose = (returnValue?: string) => {
  if (!context.visible.value) return
  context.visible.value = false
  void context.closeHook.trigger(returnValue)
}

export const context: NoticeContext = {
  dialogRef: ref(null),

  visible: ref(false),

  closeHook: createEventHook(),

  show: () => {
    const dialog = context.dialogRef.value
    if (!dialog || dialog.open) return
    context.visible.value = true
    try {
      dialog.showModal()
    } catch (error) {
      context.visible.value = false
      throw error
    }
  },

  close: (returnValue?: string) => {
    context.dialogRef.value?.close(returnValue)
    finishClose(returnValue)
  },

  syncClosed: () => {
    if (!context.dialogRef.value?.open) finishClose(context.dialogRef.value?.returnValue)
  },
}

/** AI/快照使用的别名，避免与全局 context 混淆 */
export const noticeContext = context
