import { expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { context } from '@/components/AppDialog/context'
import {
  closeSettingsDialog,
  getSettingsDialogState,
  openSettingsDialog,
} from '@/components/AppSettings/open'

const preferences = reactive({ settingActivedKey: '' })
vi.mock('@/stores', () => ({ usePreferenceStore: () => preferences }))

it('设置句柄可打开外观页签或将已打开的设置切换到外观页签', () => {
  try {
    const opened = openSettingsDialog({ section: 'appearance' })
    expect(opened.opened).toBe(true)
    expect(getSettingsDialogState()).toMatchObject({ open: true, section: 'appearance' })

    openSettingsDialog({ section: 'database' })
    expect(openSettingsDialog({ section: 'appearance' }).id).toBe(opened.id)
    expect(getSettingsDialogState().section).toBe('appearance')
  } finally {
    closeSettingsDialog()
    context.afterClosed()
  }
})
