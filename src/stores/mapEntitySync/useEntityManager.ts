import type { ManagerProgressRange, ManagerTask } from '../hooks'
import type { MapEntitySync } from './index'
import type { CommitInput, MapResource } from './model'
import { formatByteSize } from '@/utils/formatByteSize'
import { useManager } from '../hooks'

export const RECHECK_INTERVAL = 60 * 60 * 1000

type Session = ReturnType<MapEntitySync['current']>

export type DownloadProgressReporter = (ratio: number, bytes: number) => void

export interface EntityFetchTask extends ManagerTask {
  trackDownload: <T>(
    label: string,
    range: ManagerProgressRange,
    read: (report: DownloadProgressReporter) => PromiseLike<T>,
  ) => Promise<T>
}

export interface Reconciliation {
  input: CommitInput
  incomplete?: string
}

export function useEntityManager(
  sync: MapEntitySync,
  resource: MapResource,
  fetch: (session: Session, full: boolean, task: EntityFetchTask) => Promise<Reconciliation>,
) {
  const nextUpdateTime = ref(0)
  const updateLoading = ref(false)
  const message = ref('')
  const isActive = computed(() => Boolean(sync.scope) && sync.online)
  let active: Session
  let queue: { session: Session; full?: boolean; job: Promise<void> } | undefined

  const fetchWithProgress = (full: boolean, task: ManagerTask) => {
    const session = active
    return fetch(session, full, {
      ...task,
      async trackDownload(label, range, read) {
        const previous = message.value
        let started = false
        try {
          const result = await read((ratio, bytes) => {
            if (!sync.isCurrent(session)) return
            started = true
            task.report(ratio, range)
            message.value = bytes ? `${label} · 已接收 ${formatByteSize(bytes)}` : label
          })
          if (started && sync.isCurrent(session)) task.report(undefined, range)
          return result
        } finally {
          if (started && sync.isCurrent(session)) message.value = previous
        }
      },
    })
  }

  const manager = useManager({
    context: { message },
    init: async () => {
      await sync.refresh(active)
    },
    diff: (_, task) => fetchWithProgress(false, task),
    full: (_, task) => fetchWithProgress(true, task),
    commit: async (result, context) => {
      if (!result) return
      const session = active
      const { counts, conflict } = await sync.commit(session, result.input)
      sync.assertCurrent(session)
      if (result.incomplete) throw new Error(result.incomplete)
      if (conflict) throw new Error('核对期间数据有变化，等待重新核对')
      context.message.value = `更新 ${counts.updated} 项，移除 ${counts.deleted} 项`
    },
  })

  const update = ({ isFull = false }: { isFull?: boolean } = {}) => {
    if (!sync.scope) return Promise.resolve()
    const expected = sync.current()
    if (queue?.session === expected) {
      queue.full = isFull || queue.full === true
      return queue.job
    }
    updateLoading.value = true
    const batch = {
      session: expected,
      full: isFull as boolean | undefined,
      job: Promise.resolve(),
    }
    batch.job = (async () => {
      while (batch.full !== undefined && sync.isCurrent(expected)) {
        await sync.enqueue(expected, async () => {
          const full = batch.full
          batch.full = undefined
          if (full === undefined) return
          active = expected
          message.value = full ? '正在全量核对' : '正在核对'
          await manager.update({ isFull: full })
        })
      }
    })()
      .catch(cause => sync.reportError(expected, cause))
      .finally(() => {
        if (queue !== batch) return
        queue = undefined
        updateLoading.value = false
        nextUpdateTime.value = Date.now() + RECHECK_INTERVAL
      })
    queue = batch
    return batch.job
  }

  return {
    context: {
      message: computed(() => {
        const detail = message.value
        if (!sync.scope) return '等待登录'
        if (!sync.online) return '离线'
        if (!active || !sync.isCurrent(active)) return '等待核对'
        return detail
      }),
    },
    managerError: computed(() => {
      const detail = manager.error.value
      return sync.scope && active && sync.isCurrent(active) ? detail : ''
    }),
    progress: manager.progress,
    nextUpdateTime,
    updateLoading,
    isActive,
    update,
    syncState: computed(() => sync.projection.state.resources[resource]),
  }
}
