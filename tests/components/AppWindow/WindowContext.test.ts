import type { MapWindow } from '@/components/AppWindow/types'
import { describe, expect, it, vi } from 'vitest'
import { WindowContext } from '@/components/AppWindow/core/WindowContext'

const createContext = () => {
  const context = new WindowContext()
  context.setWorkspaceSize({ width: 1440, height: 900 })
  return context
}

const windowOptions = (id = 'a', options: Partial<MapWindow.WindowOpenParams> = {}) => ({
  id,
  key: `tool-${id}`,
  name: id,
  ...options,
})

const mountWindow = (context: WindowContext, id = 'a') => {
  const info = context.getWindow(id)
  if (!info) throw new Error(`窗口 ${id} 尚未创建`)
  expect(context.markMounted(info)).toBe(true)
  return info
}

const openWindow = async (context: WindowContext, options = windowOptions()) => {
  const opened = context.openWindow(options)
  await Promise.resolve()
  const info = mountWindow(context, options.id)
  expect(await opened).toBe(true)
  return info
}

describe('窗口生命周期', () => {
  it('只更新标题时保留常规位置和宽高', async () => {
    const context = createContext()
    await openWindow(context, windowOptions('a', { width: 640, height: 360, x: 80, y: 40 }))

    context.updateWindow('a', { name: '新标题' })

    expect(context.getWindow('a')).toMatchObject({
      name: '新标题',
      normalRect: { x: 80, y: 40, width: 640, height: 360 },
    })
  })

  it('相同实例的打开请求共用守卫和挂载结果', async () => {
    const context = createContext()
    const beforeOpen = vi.fn(() => true)
    const options = windowOptions('a', { beforeOpen })
    const first = context.openWindow(options)
    const second = context.openWindow(options)
    expect(first).toBe(second)
    expect(beforeOpen).toHaveBeenCalledTimes(1)

    await Promise.resolve()
    expect(context.reader.list()).toEqual([])
    const mounted = mountWindow(context)
    expect(await first).toBe(true)
    expect(await context.openWindow(options)).toBe(true)
    expect(context.getWindow('a')).toBe(mounted)
    expect(context.reader.list()[0]).toMatchObject({ id: 'a', order: 1 })
    expect(mounted.key).toBe('tool-a')
  })

  it('按请求顺序保留不同窗口的栈位，包括先完成的后续请求', async () => {
    const context = createContext()
    const guard = Promise.withResolvers<boolean>()
    const first = context.openWindow(windowOptions('a', { beforeOpen: () => guard.promise }))
    await openWindow(context, windowOptions('b'))
    guard.resolve(true)
    await Promise.resolve()
    mountWindow(context)
    await first

    expect(context.reader.list().map(({ id, order }) => [id, order])).toEqual([
      ['a', 1],
      ['b', 2],
    ])
    expect(context.isTop('b')).toBe(true)
    expect(context.isTop('a')).toBe(false)
    context.activate('a')
    expect(context.activeId.value).toBe('a')
    expect(context.isTop('a')).toBe(true)
    context.deactivate()
    expect(context.activeId.value).toBeUndefined()
    expect(context.isTop('a')).toBe(true)
  })

  it('普通关闭守卫可以同步拒绝，处置仍然清理窗口及会话布局', async () => {
    const context = createContext()
    const beforeClose = vi.fn(() => false)
    const onClosed = vi.fn()
    const options = windowOptions('a', { beforeClose, onClosed })
    const mounted = await openWindow(context, options)
    context.commitRect(mounted, { x: 110, y: 60, width: 440, height: 350 })

    expect(await context.requestClose('a')).toBe(false)
    expect(context.isOpen('a')).toBe(true)
    expect(onClosed).not.toHaveBeenCalled()
    context.clearWindow('logout')
    expect(context.reader.list()).toEqual([])
    expect(beforeClose).toHaveBeenCalledTimes(1)
    expect(onClosed).toHaveBeenCalledExactlyOnceWith('logout')

    const next = await openWindow(context, options)
    expect(next.generation).not.toBe(mounted.generation)
    expect(next.normalRect).toEqual({ x: 0, y: 0, width: 300, height: 300 })
  })

  it('登出立即取消打开，迟到的守卫或挂载回调只作用于原实例', async () => {
    const context = createContext()
    const guard = Promise.withResolvers<boolean>()
    const onClosed = vi.fn()
    const opening = context.openWindow(
      windowOptions('a', { beforeOpen: () => guard.promise, onClosed }),
    )
    const mounting = context.openWindow(windowOptions('b'))
    await Promise.resolve()
    const oldPanel = context.getWindow('b')!
    context.clearWindow('logout')
    expect(await opening).toBe(false)
    expect(await mounting).toBe(false)
    expect(onClosed).toHaveBeenCalledExactlyOnceWith('logout')

    guard.resolve(true)
    await Promise.resolve()
    expect(context.markMounted(oldPanel)).toBe(false)
    expect(context.reader.list()).toEqual([])
    expect(context.panels.value).toEqual([])
  })

  it('等待有效边界和挂点，卸载时结清并等待新宿主测量', async () => {
    const context = new WindowContext()
    const opening = context.openWindow(windowOptions())
    context.setWorkspaceSize({ width: 640, height: 0 })
    await Promise.resolve()
    expect(context.panels.value).toEqual([])

    context.setWorkspaceSize({ width: 640, height: 360 })
    const panel = context.getWindow('a')!
    expect(context.isOpen('a')).toBe(false)
    context.clearWindow('workspace')
    expect(await opening).toBe(false)
    expect(context.bounds.value).toBeUndefined()
    expect(context.markMounted(panel)).toBe(false)
    const next = context.openWindow(windowOptions())
    await Promise.resolve()
    expect(context.panels.value).toEqual([])
    context.setWorkspaceSize({ width: 500, height: 400 })
    mountWindow(context)
    expect(await next).toBe(true)
  })

  it('普通关闭取消正在打开的窗口，挂点失败也结清等待者', async () => {
    const context = createContext()
    const onClosed = vi.fn()
    const first = context.openWindow(windowOptions('a', { onClosed }))
    await Promise.resolve()
    const oldPanel = context.getWindow('a')!
    expect(await context.requestClose('a')).toBe(true)
    expect(await first).toBe(false)
    expect(onClosed).toHaveBeenLastCalledWith('cancelled')
    const second = context.openWindow(windowOptions('a', { onClosed }))
    await Promise.resolve()
    context.failMount(context.getWindow('a')!)
    expect(await second).toBe(false)
    expect(context.markMounted(oldPanel)).toBe(false)
    expect(onClosed).toHaveBeenLastCalledWith('openFailed')
  })

  it('关闭收尾结束后才能重开同 id，旧实例保留普通关闭的布局', async () => {
    const context = createContext()
    const guard = Promise.withResolvers<boolean>()
    const cleanup = Promise.withResolvers<void>()
    const onClosed = vi.fn(() => cleanup.promise)
    const options = windowOptions('a', { beforeClose: () => guard.promise, onClosed })
    const oldPanel = await openWindow(context, options)
    context.commitRect(oldPanel, { x: 8, y: 16, width: 420, height: 380 })
    const closed = context.requestClose('a')
    const reopened = context.openWindow(options)
    expect(context.openWindow(options)).toBe(reopened)
    expect(context.isOpen('a')).toBe(true)

    guard.resolve(true)
    await Promise.resolve()
    expect(context.getWindow('a')).toBeUndefined()
    expect(onClosed).toHaveBeenCalledExactlyOnceWith('user')
    cleanup.resolve()
    expect(await closed).toBe(true)
    await Promise.resolve()

    const panel = mountWindow(context)
    expect(await reopened).toBe(true)
    expect(panel.generation).not.toBe(oldPanel.generation)
    expect(panel.normalRect).toEqual({ x: 8, y: 16, width: 420, height: 380 })
  })

  it('处置原窗口和排队重开后，迟到的关闭确认不影响新会话', async () => {
    const context = createContext()
    const guard = Promise.withResolvers<boolean>()
    const onClosed = vi.fn()
    await openWindow(context, windowOptions('a', { beforeClose: () => guard.promise, onClosed }))
    const closed = context.requestClose('a')
    const oldReopen = context.openWindow(windowOptions())
    context.clearWindow('logout')
    expect(await oldReopen).toBe(false)
    expect(await closed).toBe(true)
    const newPanel = await openWindow(context)
    guard.resolve(true)
    await Promise.resolve()
    expect(context.getWindow('a')).toBe(newPanel)
    expect(onClosed).toHaveBeenCalledExactlyOnceWith('logout')
  })

  it('打开拒绝和异常释放栈位，关闭异常保留原实例', async () => {
    const context = createContext()
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fail = () => {
      throw new Error('守卫失败')
    }
    expect(await context.openWindow(windowOptions('a', { beforeOpen: () => false }))).toBe(false)
    expect(await context.openWindow(windowOptions('a', { beforeOpen: fail }))).toBe(false)
    const panel = await openWindow(context, windowOptions('b', { beforeClose: fail }))
    expect(await context.requestClose('b')).toBe(false)
    expect(context.getWindow('b')).toBe(panel)
    expect(context.reader.list()).toMatchObject([{ id: 'b', order: 1 }])
    expect(report).toHaveBeenCalledTimes(2)
  })

  it('业务清理异常不会妨碍其他窗口释放', async () => {
    const context = createContext()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onClosed = vi.fn()
    await openWindow(
      context,
      windowOptions('a', {
        onClosed: () => {
          throw new Error('清理失败')
        },
      }),
    )
    await openWindow(context, windowOptions('b', { onClosed }))
    context.clearWindow('workspace')
    expect(context.reader.list()).toEqual([])
    expect(onClosed).toHaveBeenCalledExactlyOnceWith('workspace')
  })
})

describe('工作区几何', () => {
  it('最大化适配工作区，折叠移动后仍可恢复最大化与正常矩形', async () => {
    const context = createContext()
    context.setWorkspaceSize({ width: 640, height: 360 })
    const main = await openWindow(
      context,
      windowOptions('a', { width: 460, height: 320, x: 40, y: 20 }),
    )
    context.toggleMaximize('a')
    expect(context.getWindow('a')?.displayRect).toEqual({ x: 0, y: 0, width: 640, height: 360 })
    context.toggleCollapse('a')
    const folded = context.getWindow('a')!
    expect(folded.displayRect).toEqual({ x: 0, y: 0, width: 300, height: 30 })
    context.commitRect(folded, { ...folded.displayRect, x: 50, y: 100 })
    context.toggleCollapse('a')
    expect(context.getWindow('a')?.sizeState).toBe('maximize')
    context.toggleMaximize('a')
    expect(context.getWindow('a')?.displayRect).toEqual(main.normalRect)
  })

  it('位置偏好独立于用户布局，容器缩小后可还原布局', async () => {
    const context = createContext()
    const options = windowOptions('a', { right: 6, bottom: 50, width: 320, height: 400 })
    const info = await openWindow(context, options)
    expect(info.displayRect).toEqual({ x: 1114, y: 450, width: 320, height: 400 })
    context.updateWindow('a', { right: 20 })
    expect(context.getWindow('a')?.displayRect.x).toBe(1100)
    const normal = { x: 140, y: 160, width: 550, height: 530 }
    context.commitRect(info, normal)
    context.updateWindow('a', { right: 0, minWidth: 400 })

    context.setWorkspaceSize({ width: 360, height: 260 })
    expect(context.getWindow('a')?.displayRect).toEqual({ x: 0, y: 0, width: 360, height: 260 })
    context.setWorkspaceSize({ width: 0, height: 0 })
    expect(context.bounds.value).toEqual({ width: 360, height: 260 })
    context.setWorkspaceSize({ width: 1440, height: 900 })
    expect(context.getWindow('a')?.displayRect).toEqual(normal)
  })
})
