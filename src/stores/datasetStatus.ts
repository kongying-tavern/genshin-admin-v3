import type { ManagerPhase, ManagerProgress } from './hooks'
import { toValue } from 'vue'
import { MANAGER_PHASE_LABELS } from './hooks'
import { useAreaStore } from './area'
import { useIconStore } from './icon'
import { useItemStore } from './item'
import { useItemTypeStore } from './itemType'
import { useMarkerStore } from './marker'
import { useMarkerLinkStore } from './markerLink'

/** 六类本地数据 */
export type DatasetKey = 'area' | 'icon' | 'item' | 'itemType' | 'marker' | 'markerLink'

export interface DatasetStatus {
  key: DatasetKey
  label: string
  total: number
  active: boolean
  updating: boolean
  progress: {
    percentage: number
    phase: ManagerPhase | null
    phaseLabel: string
    status: ManagerProgress['status']
    startedAt: number
    finishedAt: number
    elapsedMs: number
  }
  nextUpdateAt: number
  nextUpdateInMs: number
  error: string
  message: string
}

export interface DatasetStoreLike {
  total: unknown
  updateLoading: unknown
  nextUpdateTime: unknown
  context: { message?: unknown }
  managerError: unknown
  progress: unknown
  isActive: unknown
  update: (options?: { isFull?: boolean }) => Promise<unknown>
}

export interface DatasetDescriptor {
  key: DatasetKey
  label: string
  total: () => number
  updating: () => boolean
  active: () => boolean
  nextUpdateTime: () => number
  message: () => string
  error: () => string
  progress: () => ManagerProgress
  update: (options?: { full?: boolean }) => Promise<unknown>
}

export type DatasetStoreResolver = (key: DatasetKey) => DatasetStoreLike

const toDatasetStoreResolver = (): DatasetStoreResolver => {
  const storeMap = {
    area: () => useAreaStore(),
    icon: () => useIconStore(),
    item: () => useItemStore(),
    itemType: () => useItemTypeStore(),
    marker: () => useMarkerStore(),
    markerLink: () => useMarkerLinkStore(),
  } satisfies Record<DatasetKey, () => DatasetStoreLike>
  return key => storeMap[key]()
}

interface DatasetDefinition {
  key: DatasetKey
  label: string
  resolve: (resolver: DatasetStoreResolver) => DatasetStoreLike
}

const DATASET_DEFINITIONS: DatasetDefinition[] = [
  { key: 'area', label: '地区', resolve: resolver => resolver('area') },
  { key: 'icon', label: '图标', resolve: resolver => resolver('icon') },
  { key: 'item', label: '物品', resolve: resolver => resolver('item') },
  { key: 'itemType', label: '物品类型', resolve: resolver => resolver('itemType') },
  { key: 'marker', label: '点位', resolve: resolver => resolver('marker') },
  { key: 'markerLink', label: '点位关联', resolve: resolver => resolver('markerLink') },
]

const toNumber = (value: unknown, fallback = 0) => {
  const next = Number(toValue(value))
  return Number.isFinite(next) ? next : fallback
}

/** 使用注入的 resolver 构建描述，便于单测 */
export const createDatasets = (resolver: DatasetStoreResolver): DatasetDescriptor[] =>
  DATASET_DEFINITIONS.map(definition => {
    const store = definition.resolve(resolver)
    return {
      key: definition.key,
      label: definition.label,
      total: () => toNumber(store.total),
      updating: () => Boolean(toValue(store.updateLoading)),
      active: () => Boolean(toValue(store.isActive)),
      nextUpdateTime: () => toNumber(store.nextUpdateTime),
      message: () => {
        const message = toValue(store.context.message)
        return typeof message === 'string' ? message : ''
      },
      error: () => {
        const error = toValue(store.managerError)
        return typeof error === 'string' ? error : ''
      },
      progress: () => toValue(store.progress) as ManagerProgress,
      update: async (options = {}) => {
        await store.update({ isFull: options.full === true })
      },
    }
  })

/** 使用真实 Pinia store 构建六类描述 */
export const listDatasets = (): DatasetDescriptor[] => createDatasets(toDatasetStoreResolver())

/** 获取单个描述 */
export const getDataset = (key: DatasetKey): DatasetDescriptor | undefined =>
  listDatasets().find(dataset => dataset.key === key)

/** 转为可序列化状态 */
export const toDatasetStatus = (
  descriptor: DatasetDescriptor,
  now: () => number = Date.now,
): DatasetStatus => {
  const progress = descriptor.progress()
  const timestamp = now()
  const nextUpdateAt = descriptor.nextUpdateTime()
  const phase = progress.phase ?? null
  return {
    key: descriptor.key,
    label: descriptor.label,
    total: descriptor.total(),
    active: descriptor.active(),
    updating: descriptor.updating(),
    progress: {
      percentage: progress.percentage,
      phase,
      phaseLabel: phase ? MANAGER_PHASE_LABELS[phase] : '',
      status: progress.status,
      startedAt: progress.startedAt,
      finishedAt: progress.finishedAt,
      elapsedMs:
        progress.startedAt > 0
          ? Math.max(0, (progress.finishedAt || timestamp) - progress.startedAt)
          : 0,
    },
    nextUpdateAt,
    nextUpdateInMs: Math.max(0, nextUpdateAt - timestamp),
    error: descriptor.error(),
    message: descriptor.message(),
  }
}

export interface WaitDatasetsIdleOptions {
  keys?: DatasetKey[]
  /** @default 120000 */
  timeoutMs?: number
  /** @default 200 */
  pollMs?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface WaitDatasetsIdleResult {
  items: DatasetStatus[]
  timedOut: boolean
}

const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

/** 等待指定 dataset 全部空闲；超时返回当前状态而不是抛错 */
export const waitForDatasetsIdle = async (
  datasets: DatasetDescriptor[],
  options: WaitDatasetsIdleOptions = {},
): Promise<WaitDatasetsIdleResult> => {
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? defaultSleep
  const timeoutMs = Math.max(0, options.timeoutMs ?? 120000)
  const pollMs = Math.max(10, options.pollMs ?? 200)
  const keys = new Set<DatasetKey>(options.keys ?? datasets.map(item => item.key))
  const startedAt = now()

  for (;;) {
    const items = datasets.map(item => toDatasetStatus(item, now))
    const pending = items.filter(
      item => keys.has(item.key) && (item.updating || item.progress.status === 'running'),
    )
    if (!pending.length) return { items, timedOut: false }

    const elapsed = now() - startedAt
    if (elapsed >= timeoutMs) return { items, timedOut: true }

    await sleep(Math.min(pollMs, Math.max(1, timeoutMs - elapsed)))
  }
}
