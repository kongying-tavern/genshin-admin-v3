import { describe, expect, it, vi } from 'vitest'
import {
  createDatasets,
  toDatasetStatus,
  waitForDatasetsIdle,
  type DatasetKey,
  type DatasetStoreLike,
} from '@/stores/datasetStatus'

interface FakeStore extends Omit<DatasetStoreLike, 'update'> {
  update: ReturnType<typeof vi.fn>
}

const createStore = (overrides: Partial<FakeStore> = {}): FakeStore => ({
  total: 3,
  updateLoading: false,
  nextUpdateTime: 5000,
  context: { message: 'checking' },
  managerError: '',
  progress: {
    percentage: 0,
    phase: null,
    status: 'idle',
    startedAt: 0,
    finishedAt: 0,
  },
  isActive: true,
  update: vi.fn(async () => {}),
  ...overrides,
})

const createResolver = (stores: Partial<Record<DatasetKey, FakeStore>>) => {
  const fallback = createStore()
  return (key: DatasetKey) => (stores[key] ?? fallback) as DatasetStoreLike
}

describe('stores/datasetStatus', () => {
  it('构建六类数据集并保持一致顺序', () => {
    const datasets = createDatasets(createResolver({}))
    expect(datasets.map(item => item.key)).toEqual([
      'area',
      'icon',
      'item',
      'itemType',
      'marker',
      'markerLink',
    ])
    expect(datasets.map(item => item.label)).toEqual([
      '地区',
      '图标',
      '物品',
      '物品类型',
      '点位',
      '点位关联',
    ])
  })

  it('映射状态字段、阶段文案与下次更新时间', () => {
    const store = createStore({
      total: 12,
      updateLoading: true,
      nextUpdateTime: 7000,
      context: { message: '拉取中' },
      managerError: 'oops',
      progress: {
        percentage: 42.5,
        phase: 'fetch',
        status: 'running',
        startedAt: 1000,
        finishedAt: 0,
      },
      isActive: false,
    })
    const [dataset] = createDatasets(createResolver({ marker: store })).filter(
      item => item.key === 'marker',
    )
    const status = toDatasetStatus(dataset, () => 2000)

    expect(status).toMatchObject({
      key: 'marker',
      label: '点位',
      total: 12,
      active: false,
      updating: true,
      nextUpdateAt: 7000,
      nextUpdateInMs: 5000,
      error: 'oops',
      message: '拉取中',
    })
    expect(status.progress).toMatchObject({
      percentage: 42.5,
      phase: 'fetch',
      phaseLabel: '拉取',
      status: 'running',
      elapsedMs: 1000,
    })
  })

  it('update 会将 full 转为 isFull', async () => {
    const store = createStore()
    const dataset = createDatasets(createResolver({ marker: store })).find(
      item => item.key === 'marker',
    )!
    await dataset.update({ full: true })
    expect(store.update).toHaveBeenCalledWith({ isFull: true })
  })

  it('waitForDatasetsIdle 在空闲时立即返回', async () => {
    const datasets = createDatasets(createResolver({}))
    const result = await waitForDatasetsIdle(datasets, { timeoutMs: 1000, pollMs: 10 })
    expect(result.timedOut).toBe(false)
  })

  it('waitForDatasetsIdle 等待更新结束', async () => {
    const store = createStore({
      updateLoading: true,
      progress: {
        percentage: 10,
        phase: 'fetch',
        status: 'running',
        startedAt: 0,
        finishedAt: 0,
      },
    })
    const datasets = createDatasets(createResolver({ marker: store }))
    let slept = 0
    const result = await waitForDatasetsIdle(datasets, {
      keys: ['marker'],
      timeoutMs: 1000,
      pollMs: 10,
      sleep: async () => {
        slept += 1
        store.updateLoading = false
        store.progress = {
          percentage: 100,
          phase: null,
          status: 'success',
          startedAt: 0,
          finishedAt: 1,
        }
      },
    })
    expect(slept).toBe(1)
    expect(result.timedOut).toBe(false)
    expect(result.items.find(item => item.key === 'marker')?.updating).toBe(false)
  })

  it('waitForDatasetsIdle 超时返回当前状态', async () => {
    const store = createStore({
      updateLoading: true,
      progress: {
        percentage: 10,
        phase: 'fetch',
        status: 'running',
        startedAt: 0,
        finishedAt: 0,
      },
    })
    const datasets = createDatasets(createResolver({ marker: store }))
    const result = await waitForDatasetsIdle(datasets, {
      keys: ['marker'],
      timeoutMs: 10,
      pollMs: 5,
      sleep: async () => {},
    })
    expect(result.timedOut).toBe(true)
  })
})
