import { useFetchHook } from '@/hooks'

/** 一次更新会依次经过的阶段 */
export type ManagerPhase = 'init' | 'fetch' | 'sync' | 'commit'

/** 阶段的中文名，供 UI 直接展示 */
export const MANAGER_PHASE_LABELS: Record<ManagerPhase, string> = {
  init: '初始化',
  fetch: '拉取',
  sync: '同步',
  commit: '写入',
}

/**
 * 各阶段缺省权重
 * - `fetch` 包含网络请求与本地计算，通常是耗时大头
 * - `commit` 是 IndexedDB 写入，数据量大时同样不可忽略
 */
const DEFAULT_PHASE_WEIGHTS: Record<ManagerPhase, number> = {
  init: 6,
  fetch: 68,
  sync: 6,
  commit: 20,
}

/** 进度值：`0~1` 的比例，或 `{ loaded, total }` 形式的计数 */
export type ManagerProgressValue = number | { loaded: number; total: number }

/** 阶段内的子区间，用于把一个阶段拆成多个步骤上报 */
export interface ManagerProgressRange {
  /** 子步骤在阶段内的起点 `0~1` @default 0 */
  from?: number
  /** 子步骤在阶段内的终点 `0~1` @default 1 */
  to?: number
}

/**
 * 阶段任务上报器
 *
 * 由管理器按阶段下发，更新实现通过它上报「自己这部分」的进度，
 * 管理器再按权重换算成整体进度，因此各阶段既不需要关心彼此，
 * 也不需要关心整体百分比是多少。
 */
export interface ManagerTask {
  /** 所属阶段 */
  readonly phase: ManagerPhase
  /**
   * 上报当前阶段的进度，阶段内只增不减
   *
   * - `report(0.4)`：阶段内完成 40%
   * - `report({ loaded, total })`：按任务计数推进
   * - `report()`：阶段完成
   * - `report(value, { from, to })`：把进度映射到阶段内的子区间，
   *   适用于「请求 → 计算 → 分批拉取」这类多步骤阶段
   */
  report: (value?: ManagerProgressValue, range?: ManagerProgressRange) => void
}

export type ManagerProgressStatus = 'idle' | 'running' | 'success' | 'error'

/** 对外暴露的更新进度 */
export interface ManagerProgress {
  /** 整体完成度 `0~100`，一次更新内只增不减 */
  percentage: number
  /** 当前所处阶段，空闲时为 `null` */
  phase: ManagerPhase | null
  /** 更新状态 */
  status: ManagerProgressStatus
  /** 本次更新的开始时间戳 */
  startedAt: number
  /** 本次更新的结束时间戳，进行中为 `0` */
  finishedAt: number
}

export interface ManagerOptions<C, T> {
  /** 是否启用定时更新 */
  timeoutPull?: {
    /** 更新间隔, 单位毫秒 */
    time: number
    /** 当条件满足时会开始定时更新，条件不满足时会暂停定时更新 */
    condition: () => boolean
  }
  /** 自定义上下文 */
  context: C
  /**
   * 覆盖各阶段的进度权重，缺省使用内置比例
   * - 权重只用于换算整体百分比，内部会按实际执行的阶段归一化
   */
  progressWeights?: Partial<Record<ManagerPhase, number>>
  /** 初始化上下文 */
  init?: (context: C, task: ManagerTask) => Promise<void> | void
  /** 差异更新数据 */
  diff?: (context: C, task: ManagerTask) => Promise<T>
  /** 全量更新数据 */
  full: (context: C, task: ManagerTask) => Promise<T>
  /** 写入数据 */
  commit: (data: Awaited<T> | void, context: C, task: ManagerTask) => Promise<void> | void
  /**
   * 用于同步本地状态
   * @param data 要同步的数据，通常是 diff 或 full 返回的数据
   * @param context 上下文
   * @param isInit 是否为 init 阶段（true: 完全替换; false: 增量更新）
   * @param task 进度上报器
   */
  syncState?: (
    data: T | void,
    context: C,
    isInit: boolean,
    task: ManagerTask,
  ) => Promise<void> | void
}

export interface ManagerUpdateOptions {
  isFull?: boolean
}

/** 阶段在整体进度中占用的区间 */
interface PhaseSlice {
  /** 起点 `0~1` */
  offset: number
  /** 占比 `0~1` */
  weight: number
}

/** 把上报值归一化为 `0~1`，并映射到给定的子区间 */
const toRatio = (value?: ManagerProgressValue, range?: ManagerProgressRange) => {
  let local = 1
  if (typeof value === 'number') {
    local = value
  } else if (value) {
    // 总数为 0 说明这一步无事可做，直接视为完成，避免进度停在原地
    local = value.total > 0 ? value.loaded / value.total : 1
  }
  if (!Number.isFinite(local)) local = 0
  local = Math.min(1, Math.max(0, local))

  const from = Math.min(1, Math.max(0, range?.from ?? 0))
  const to = Math.min(1, Math.max(from, range?.to ?? 1))
  return from + (to - from) * local
}

export const useManager = <C, T>(options: ManagerOptions<C, T>) => {
  const { timeoutPull, context, init, diff, full, commit, syncState, progressWeights } = options

  const errorMessage = ref('')

  const initFlag = ref(false)

  const progress = reactive<ManagerProgress>({
    percentage: 0,
    phase: null,
    status: 'idle',
    startedAt: 0,
    finishedAt: 0,
  })

  /** 每次更新的序号，用于丢弃已被新更新接管的进度上报 */
  let runSeq = 0

  /** 被新一次更新接管的下标：序号对不上就是陈旧任务 */
  const isStale = (run: number) => run !== runSeq

  /** 本次更新失败的阶段，用于在错误信息为空时补一句可读的提示 */
  let failedPhase: ManagerPhase | null = null

  const phaseWeights: Record<ManagerPhase, number> = {
    ...DEFAULT_PHASE_WEIGHTS,
    ...progressWeights,
  }

  /** 按实际会执行的阶段分配区间，跳过阶段的权重不会被浪费 */
  const createPhaseSlices = (phases: ManagerPhase[]) => {
    const slices = new Map<ManagerPhase, PhaseSlice>()
    const totalWeight = phases.reduce((sum, phase) => sum + Math.max(0, phaseWeights[phase]), 0)
    let cursor = 0
    for (const phase of phases) {
      // 权重被全部配成 0 时退化为均分，否则进度会一直卡在起点
      const weight =
        totalWeight > 0 ? Math.max(0, phaseWeights[phase]) / totalWeight : 1 / phases.length
      slices.set(phase, { offset: cursor, weight })
      cursor += weight
    }
    return slices
  }

  /** 推进进度，永不回退；结束前最多到 99.9，避免提前显示 100 */
  const advance = (target: number) => {
    const next = Math.min(99.9, Math.max(progress.percentage, Number.isFinite(target) ? target : 0))
    progress.percentage = Math.round(next * 10) / 10
  }

  const enterPhase = (run: number, phase: ManagerPhase, slice: PhaseSlice) => {
    if (isStale(run)) return
    progress.phase = phase
    // 即使该阶段一次进度都不上报，进度条也会先走到阶段的起点
    advance(slice.offset * 100)
  }

  const settlePhase = (run: number, slice: PhaseSlice) => {
    if (isStale(run)) return
    advance((slice.offset + slice.weight) * 100)
  }

  const createTask = (run: number, phase: ManagerPhase, slice: PhaseSlice): ManagerTask => {
    /** 阶段内已完成比例，保证只增不减 */
    let ratio = 0
    return {
      phase,
      report: (value, range) => {
        // 已被新的一次更新接管，旧任务的上报直接丢弃，避免进度倒退或乱跳
        if (isStale(run)) return
        ratio = Math.max(ratio, toRatio(value, range))
        advance((slice.offset + slice.weight * ratio) * 100)
      },
    }
  }

  const {
    refresh: update,
    loading,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async (updateOptions: ManagerUpdateOptions = {}) => {
      errorMessage.value = ''
      const { isFull = false } = updateOptions
      const isInit = !initFlag.value

      const run = ++runSeq
      progress.status = 'running'
      progress.phase = null
      progress.percentage = 0
      progress.startedAt = Date.now()
      progress.finishedAt = 0
      failedPhase = null

      // 只规划本次真正会执行的阶段：首次更新才需要 init，没配 syncState 就没有 sync
      const phases: ManagerPhase[] = []
      if (isInit && init) phases.push('init')
      phases.push('fetch')
      if (syncState) phases.push('sync')
      phases.push('commit')
      const slices = createPhaseSlices(phases)

      try {
        if (isInit) {
          const slice = slices.get('init')
          if (slice) {
            enterPhase(run, 'init', slice)
            await init?.(context, createTask(run, 'init', slice))
            // 冷数据确实已经读完，即使流程被接管也要记下，避免下次重复读取
            initFlag.value = true
            // 期间又发起了新的更新，旧流程到此为止，不要再改状态、写文案或落库
            if (isStale(run)) return
            settlePhase(run, slice)
          } else {
            // 即使没有 init 实现，首次更新也只发生一次
            initFlag.value = true
          }
        }

        const fetchSlice = slices.get('fetch')!
        enterPhase(run, 'fetch', fetchSlice)
        // 首次更新只需要拉一次冷数据，diff / full 的结果由下面的统一分支产出，
        // 在这里额外跑一次 diff 会把整批点位查询白白发两遍
        const data = await (isFull ? full : (diff ?? full))(
          context,
          createTask(run, 'fetch', fetchSlice),
        )
        if (isStale(run)) return
        settlePhase(run, fetchSlice)

        if (syncState) {
          const slice = slices.get('sync')!
          enterPhase(run, 'sync', slice)
          await syncState(data, context, isInit, createTask(run, 'sync', slice))
          if (isStale(run)) return
          settlePhase(run, slice)
        }

        const commitSlice = slices.get('commit')!
        enterPhase(run, 'commit', commitSlice)
        await commit(data, context, createTask(run, 'commit', commitSlice))
        if (isStale(run)) return
        settlePhase(run, commitSlice)

        progress.percentage = 100
        progress.status = 'success'
        progress.finishedAt = Date.now()
      } catch (err) {
        // 被接管的旧任务连失败都没有意义了，吞掉以免污染当前更新的错误状态
        if (isStale(run)) return
        // 进度只负责描述过程，错误仍交给 useFetchHook 统一上报
        failedPhase = progress.phase
        progress.status = 'error'
        progress.finishedAt = Date.now()
        throw err
      } finally {
        if (!isStale(run)) progress.phase = null
      }
    },
  })

  onError(err => {
    // 服务端异常时可能拿不到任何错误文案（例如 HTTP/2 的空 statusText），
    // 留空会让界面继续显示上一次更新的结论，所以这里必须兜一句
    const label = MANAGER_PHASE_LABELS[failedPhase ?? 'fetch']
    errorMessage.value = err.message || `${label}失败：未获取到错误信息`
  })

  /** 下一次更新的时间 */
  const nextUpdateTime = ref<number>(Date.now())

  const pollTime = ref(0)

  const { isActive, pause, resume } = useTimeoutPoll(
    async () => {
      if (!loading.value) await update()
      nextUpdateTime.value = Date.now() + pollTime.value
    },
    pollTime,
    {
      immediate: false,
    },
  )

  if (timeoutPull) {
    const { condition, time } = timeoutPull
    pollTime.value = time
    watch(
      () => condition(),
      isTrue => {
        if (!isTrue) {
          pause()
          return
        }
        resume()
      },
      { immediate: true },
    )
  }

  return {
    error: errorMessage,
    context,
    update,
    onError,
    loading,
    progress,
    nextUpdateTime,
    isActive,
    ...rest,
  }
}
