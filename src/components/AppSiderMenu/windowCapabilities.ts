import type { WindowContextHookReturnType } from '@/components/AppWindow/hooks'
import type { ManagerWindowOption } from './windowOptions'
import { registerCapability } from '@/ai/bindings'

export const registerWindowCapability = (
  option: Pick<ManagerWindowOption, 'key' | 'name'>,
  hook: Pick<WindowContextHookReturnType, 'open' | 'close' | 'info' | 'isOpen'>,
  enabled: () => boolean,
) =>
  registerCapability({
    id: `window.${option.key}`,
    kind: 'window',
    title: option.name,
    description: `打开窗口：${option.name}`,
    enabled,
    open: hook.open,
    close: hook.close,
    getState: () => ({
      open: hook.isOpen.value,
      sizeState: hook.info.value?.sizeState,
    }),
  })
