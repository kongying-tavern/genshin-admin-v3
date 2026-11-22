import type { ManagerWindowOption } from '@/components/AppSiderMenu/windowOptions'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, onUnmounted, provide, ref, watchEffect } from 'vue'
import { clearBindings } from '@/ai/bindings'
import { createUiCommands } from '@/ai/commands/ui'
import { createEventLog } from '@/ai/events'
import { buildManifest } from '@/ai/help'
import { createBridge } from '@/ai/registry'
import { createSnapshotBuilder } from '@/ai/snapshot'
import { watchWindowNames } from '@/ai/windowState'
import { registerWindowCapability } from '@/components/AppSiderMenu/windowCapabilities'
import { MANAGER_WINDOW_OPTIONS, USER_MANUAL_WINDOW } from '@/components/AppSiderMenu/windowOptions'
import { WindowContext } from '@/components/AppWindow/core'
import { useAppWindow } from '@/components/AppWindow/hooks'
import { windowContextKey } from '@/components/AppWindow/hooks/windowWorkspace'

vi.mock('@/stores/notice', () => ({ useNoticeStore: vi.fn() }))

const options = [...MANAGER_WINDOW_OPTIONS, USER_MANUAL_WINDOW]

const createHarness = (beforeClose?: () => boolean | Promise<boolean>) => {
  const windows = new WindowContext()
  windows.setWorkspaceSize({ width: 1280, height: 720 })
  const roles = ref(new Set<ManagerWindowOption['role']>())
  const Owner = defineComponent({
    setup() {
      for (const option of options) {
        const enabled = () => roles.value.has(option.role)
        const handle = useAppWindow({
          key: option.key,
          name: option.name,
          sizeState: 'maximize',
          minWidth: 887,
          minHeight: 500,
          enabled,
          beforeClose,
        })
        onUnmounted(registerWindowCapability(option, handle, enabled))
      }
      return () => null
    },
  })
  const Root = defineComponent({
    components: { Owner },
    setup() {
      provide(windowContextKey, windows)
      watchEffect(
        () => {
          for (const { info } of windows.panels.value) windows.markMounted(info)
        },
        { flush: 'post' },
      )
    },
    template: '<Owner />',
  })
  const wrapper = mount(Root)
  const eventLog = createEventLog()
  const stop = watchWindowNames(windows.reader, payload => eventLog.emit('window:change', payload))
  const commands = createUiCommands()
  const manifest = () =>
    buildManifest({
      mode: 'read',
      modeSource: 'query',
      protocolVersion: '1.0.0',
      schemaVersion: 1,
      commands,
      surfaces: [],
      snapshotSections: ['ui'],
      events: ['window:change'],
    })
  const snapshot = createSnapshotBuilder([
    {
      key: 'ui',
      title: '界面',
      build: ({ includeWindowStates }) => ({
        windows: includeWindowStates ? windows.reader.list() : [],
      }),
    },
  ])
  const { bridge } = createBridge({
    mode: 'read',
    modeSource: 'query',
    commands,
    eventLog,
    manifest,
    help: () => '',
    snapshot,
  })
  return {
    bridge,
    roles,
    windows,
    eventLog,
    dispose: () => {
      stop()
      bridge.dispose()
      wrapper.unmount()
    },
  }
}

afterEach(clearBindings)

describe('AI 管理窗口', () => {
  it.each(options)('$name 保留句柄、角色和读模式契约', async ({ key, name, role }) => {
    const { bridge, roles, eventLog, dispose } = createHarness()
    try {
      const id = `window.${key}`
      const params = { id }
      const list = await bridge.call('ui.surfaces.list', { kind: 'window' })
      expect(list).toMatchObject({
        ok: true,
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({ id, available: false, open: false }),
          ]),
        },
      })
      expect(await bridge.call('ui.surfaces.open', params)).toMatchObject({
        ok: false,
        error: { code: 'E_FORBIDDEN' },
      })

      roles.value.add(role)
      expect(await bridge.call('ui.surfaces.open', params)).toMatchObject({
        ok: true,
        data: { id, opened: true, queued: false, sinceSeq: expect.any(Number) },
      })
      expect(await bridge.call('ui.surfaces.get', params)).toMatchObject({
        ok: true,
        data: { id, available: true, open: true, state: { sizeState: 'maximize' } },
      })
      const snapshot = await bridge.snapshot({ sections: ['ui'] })
      expect(snapshot.ui).toEqual({
        windows: [
          {
            id: expect.not.stringMatching(/^window\./),
            name,
            order: 1,
            sizeState: 'maximize',
            interactionState: null,
            size: { width: 887, height: 500 },
            translate: { x: 0, y: 0 },
          },
        ],
      })
      expect((await bridge.snapshot({ includeWindowStates: false })).ui).toEqual({ windows: [] })
      expect(await bridge.call('ui.surfaces.close', params)).toMatchObject({
        ok: true,
        data: { id, closed: true },
      })
      expect(eventLog.list({ type: 'window:change' }).map(event => event.payload)).toEqual([
        { names: [name] },
        { names: [] },
      ])
      expect(await bridge.call('ui.notices.read', { id: 1 })).toMatchObject({
        ok: false,
        error: { code: 'E_FORBIDDEN' },
      })
    } finally {
      dispose()
    }
  })

  it('关闭等待守卫，守卫拒绝时只返回状态，撤权处置并发布空列表', async () => {
    const guard = Promise.withResolvers<boolean>()
    const { bridge, roles, eventLog, windows, dispose } = createHarness(() => guard.promise)
    try {
      const id = 'window.userManual'
      roles.value.add(USER_MANUAL_WINDOW.role)
      await bridge.call('ui.surfaces.open', { id })
      const close = bridge.call('ui.surfaces.close', { id })
      await nextTick()
      expect(windows.reader.names()).toEqual(['用户手册'])
      guard.resolve(false)
      expect(await close).toMatchObject({ ok: true, data: { id, closed: false } })
      expect(eventLog.list({ type: 'surface:close' })).toEqual([])

      roles.value.clear()
      await nextTick()
      expect(windows.reader.list()).toEqual([])
      expect(eventLog.list({ type: 'window:change' }).at(-1)?.payload).toEqual({ names: [] })
      expect(await bridge.call('ui.surfaces.close', { id })).toMatchObject({
        ok: true,
        data: { id, closed: true },
      })
    } finally {
      dispose()
    }
  })

  it('排序名称保持完整，调整布局和置顶期间不会发布名称变化', async () => {
    const { bridge, roles, eventLog, windows, dispose } = createHarness()
    try {
      roles.value.add(USER_MANUAL_WINDOW.role)
      roles.value.add(MANAGER_WINDOW_OPTIONS[0].role)
      await bridge.call('ui.surfaces.open', { id: 'window.userManual' })
      await bridge.call('ui.surfaces.open', { id: 'window.itemManager' })
      const [manual] = windows.reader.list()
      windows.updateWindow(manual.id, { name: '手册|帮助' })
      await nextTick()
      const events = () => eventLog.list({ type: 'window:change' })
      expect(events().at(-1)?.payload).toEqual({ names: ['手册|帮助', '物品管理'].sort() })
      const count = events().length
      windows.activate(manual.id)
      windows.setInteractionState(windows.getWindow(manual.id)!, 'manual')
      windows.toggleMaximize(manual.id)
      await nextTick()
      expect(events()).toHaveLength(count)
    } finally {
      dispose()
    }
  })
})
