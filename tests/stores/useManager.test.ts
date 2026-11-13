import type { ManagerOptions } from '@/stores/hooks/useManager'
import { describe, expect, it } from 'vitest'
import { effectScope, watch } from 'vue'
import { useManager } from '@/stores/hooks/useManager'

/**
 * 单元测试：更新管理器进度（`src/stores/hooks/useManager.ts`）
 *
 * 进度条需要反映真实的工作量，因此这里要保证：
 * 阶段按权重换算整体百分比、阶段内只增不减、跳过的阶段不占进度、
 * 以及被新更新接管的旧任务不会污染当前进度。
 */

/** 让当前宏任务内的微任务链全部跑完 */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0))

/** 在独立的 effect scope 中创建管理器，避免 vueuse 的清理钩子告警 */
const createManager = <C, T>(options: ManagerOptions<C, T>) => {
  const manager = effectScope().run(() => useManager<C, T>(options))
  if (!manager) throw new Error('useManager 创建失败')
  return manager
}

/** 记录进度百分比的变化轨迹 */
const trackPercentage = (manager: ReturnType<typeof createManager<unknown, unknown>>) => {
  const values: number[] = []
  watch(
    () => manager.progress.percentage,
    v => values.push(v),
    { flush: 'sync' },
  )
  return values
}

describe('useManager 进度', () => {
  it('按阶段依次推进，结束时到达 100', async () => {
    const phases: (string | null)[] = []
    const manager = createManager<Record<string, never>, number>({
      context: {},
      init: async () => {},
      full: async () => 1,
      syncState: () => {},
      commit: () => {},
    })
    watch(
      () => manager.progress.phase,
      v => phases.push(v),
      { flush: 'sync' },
    )

    await manager.update()

    expect(phases).toEqual(['init', 'fetch', 'sync', 'commit', null])
    expect(manager.progress.percentage).toBe(100)
    expect(manager.progress.status).toBe('success')
  })

  it('阶段内的上报按权重换算为整体进度', async () => {
    const manager = createManager<Record<string, never>, number>({
      context: {},
      init: async () => {},
      full: async (_context, task) => {
        task.report(0.5)
        return 1
      },
      syncState: () => {},
      commit: () => {},
    })
    const values = trackPercentage(manager)

    await manager.update()

    // init 占 6%，fetch 占 68%，fetch 走到一半即 6 + 34
    expect(values).toContain(40)
  })

  it('同一阶段内的进度只增不减', async () => {
    const manager = createManager<Record<string, never>, number>({
      context: {},
      init: async () => {},
      full: async (_context, task) => {
        task.report(0.8)
        task.report(0.2)
        return 1
      },
      syncState: () => {},
      commit: () => {},
    })
    const values = trackPercentage(manager)

    await manager.update()

    expect(values).toContain(60.4)
    expect(values).not.toContain(19.6)
    expect(values.every((value, index) => index === 0 || value >= values[index - 1])).toBe(true)
  })

  it('window 可以把进度映射到阶段内的子区间', async () => {
    const manager = createManager<Record<string, never>, number>({
      context: {},
      init: async () => {},
      full: async (_context, task) => {
        // 只完成后半段工作时，整体进度不应从阶段起点重新算起
        task.report({ loaded: 50, total: 100 }, { from: 0.2, to: 0.6 })
        return 1
      },
      syncState: () => {},
      commit: () => {},
    })
    const values = trackPercentage(manager)

    await manager.update()

    // 6 + 68 * (0.2 + 0.4 * 0.5)
    expect(values).toContain(33.2)
  })

  it('没有上报的阶段也会推进到阶段边界', async () => {
    let release!: () => void
    const manager = createManager<Record<string, never>, number>({
      context: {},
      init: async () => {},
      // fetch 与 sync 都不上报，全靠阶段切换推进
      full: async () => 1,
      syncState: () => {},
      commit: async () => {
        await new Promise<void>(resolve => (release = resolve))
      },
    })

    const promise = manager.update()
    await flush()

    // init 6% + fetch 68% + sync 6%
    expect(manager.progress.percentage).toBe(80)
    expect(manager.progress.phase).toBe('commit')

    release()
    await promise
    expect(manager.progress.percentage).toBe(100)
  })

  it('第二次更新不再执行 init，进度从 fetch 重新开始', async () => {
    let initCount = 0
    const manager = createManager<Record<string, never>, number>({
      context: {},
      init: async () => {
        initCount += 1
      },
      full: async () => 1,
      commit: () => {},
    })

    await manager.update()

    const values = trackPercentage(manager)
    await manager.update()

    expect(initCount).toBe(1)
    // 没有 init 阶段，fetch 从 0 起步而不是从 init 的 6% 起步
    expect(values[0]).toBe(0)
  })

  it('更新失败时保留进度并标记为 error', async () => {
    const manager = createManager<Record<string, never>, number>({
      context: {},
      full: async () => {
        throw new Error('boom')
      },
      commit: () => {},
    })

    await manager.update()

    expect(manager.progress.status).toBe('error')
    expect(manager.error.value).toBe('boom')
    expect(manager.progress.percentage).toBeLessThan(100)
  })

  it('错误信息为空时给出可读的失败提示', async () => {
    const manager = createManager<Record<string, never>, number>({
      context: {},
      init: async () => {},
      full: async () => {
        // HTTP/2 下 statusText 为空，上层可能只能拿到空错误文案
        throw new Error('')
      },
      commit: () => {},
    })

    await manager.update()

    expect(manager.progress.status).toBe('error')
    expect(manager.error.value).toBe('拉取失败：未获取到错误信息')
  })

  it('被接管的旧任务不会继续执行后续阶段', async () => {
    let releaseFirst!: () => void
    let releaseSecond!: () => void
    let call = 0
    let syncCount = 0
    const manager = createManager<Record<string, never>, number>({
      context: {},
      full: async () => {
        call += 1
        await new Promise<void>(resolve => {
          if (call === 1) releaseFirst = resolve
          else releaseSecond = resolve
        })
        return 1
      },
      syncState: () => {
        syncCount += 1
      },
      commit: () => {},
    })

    const first = manager.update()
    await flush()
    const second = manager.update()
    await flush()

    releaseFirst()
    await first
    // 旧任务在 fetch 结束时就该收手，不能继续改写状态、落库或覆盖新任务的提示文案
    expect(syncCount).toBe(0)

    releaseSecond()
    await second
    expect(syncCount).toBe(1)
  })

  it('被接管的旧任务失败时不会污染当前错误状态', async () => {
    let rejectFirst!: (err: Error) => void
    let call = 0
    const manager = createManager<Record<string, never>, number>({
      context: {},
      full: async () => {
        call += 1
        if (call === 1) {
          await new Promise<void>((_, reject) => {
            rejectFirst = reject
          })
        }
        // 第二次更新一直挂起，保证断言期间仍处于进行中
        await new Promise<void>(() => {})
        return 1
      },
      commit: () => {},
    })

    const first = manager.update()
    await flush()
    manager.update()
    await flush()

    rejectFirst(new Error('stale boom'))
    await first

    expect(manager.error.value).toBe('')
    expect(manager.progress.status).toBe('running')
  })

  it('被接管的旧任务迟到的上报不会污染新一次更新', async () => {
    let releaseFirst!: () => void
    let releaseSecond!: () => void
    let call = 0
    const manager = createManager<Record<string, never>, number>({
      context: {},
      full: async (_context, task) => {
        call += 1
        if (call === 1) {
          await new Promise<void>(resolve => (releaseFirst = resolve))
          // 旧任务完成时已经没有资格改写进度
          task.report(1)
          return 1
        }
        task.report(0.5)
        await new Promise<void>(resolve => (releaseSecond = resolve))
        return 1
      },
      commit: () => {},
    })

    const first = manager.update()
    await flush()
    const second = manager.update()
    await flush()

    releaseFirst()
    await first

    // 第二次更新没有 init / sync，fetch 独占 68/88，一半约为 38.6%
    expect(manager.progress.percentage).toBe(38.6)
    expect(manager.progress.status).toBe('running')

    releaseSecond()
    await second
    expect(manager.progress.percentage).toBe(100)
  })
})
