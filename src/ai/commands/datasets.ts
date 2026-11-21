import type { BridgeCommand } from '@/ai/types'
import { fail } from '@/ai/errors'
import { objectSchema } from '@/ai/validate'
import {
  getDataset,
  listDatasets,
  toDatasetStatus,
  waitForDatasetsIdle,
  type DatasetKey,
} from '@/stores/datasetStatus'
import { useUserStore } from '@/stores/user'

const DATASET_KEYS: DatasetKey[] = ['area', 'icon', 'item', 'itemType', 'marker', 'markerLink']

const assertLoggedIn = () => {
  if (useUserStore().info?.roleId === undefined) {
    fail('E_FORBIDDEN', '请先登录后再触发本地数据库更新')
  }
}

/** datasets.* 命令 */
export const createDatasetCommands = (): BridgeCommand[] => [
  {
    id: 'datasets.list',
    title: '本地数据更新状态',
    description: '读取设置→数据库页签中六类本地数据的总数、定时更新、进度、下一次更新时间与错误',
    access: 'read',
    params: objectSchema({}),
    returns: '{ items: DatasetStatus[] }',
    examples: [{ title: '读取六类数据库状态' }],
    handler: () => ({
      items: listDatasets().map(dataset => toDatasetStatus(dataset)),
    }),
  },
  {
    id: 'datasets.get',
    title: '单类数据更新状态',
    description: '读取指定数据集的更新状态',
    access: 'read',
    params: objectSchema(
      { key: { type: 'string', enum: DATASET_KEYS, description: '数据集 key' } },
      ['key'],
    ),
    returns: 'DatasetStatus',
    examples: [{ title: '读取点位数据库状态', params: { key: 'marker' } }],
    handler: params => {
      const dataset = getDataset(params.key as DatasetKey)
      if (!dataset) fail('E_NOT_FOUND', `数据集不存在：${params.key as string}`)
      return toDatasetStatus(dataset)
    },
  },
  {
    id: 'datasets.update',
    title: '触发本地数据更新',
    description:
      '触发指定数据集的差异/全量更新，立即返回；配合 datasets.waitIdle 或 events.waitFor 等待结束',
    access: 'write',
    tags: ['network'],
    params: objectSchema(
      {
        key: { type: 'string', enum: DATASET_KEYS, description: '数据集 key' },
        full: {
          type: 'boolean',
          default: false,
          description: 'true 为重新获取（全量），false 为差异更新',
        },
      },
      ['key'],
    ),
    returns: '{ key, started, reason?, status, sinceSeq }',
    examples: [{ title: '差异更新点位数据库', params: { key: 'marker' } }],
    handler: (params, context) => {
      assertLoggedIn()
      const key = params.key as DatasetKey
      const dataset = getDataset(key)
      if (!dataset) fail('E_NOT_FOUND', `数据集不存在：${key}`)

      const status = toDatasetStatus(dataset)
      if (dataset.updating()) {
        return {
          key,
          started: false,
          reason: 'busy',
          status,
          sinceSeq: context.currentSeq(),
        }
      }

      const sinceSeq = context.currentSeq()
      void dataset.update({ full: params.full === true }).catch(() => false)
      return {
        key,
        started: true,
        status: toDatasetStatus(dataset),
        sinceSeq,
      }
    },
  },
  {
    id: 'datasets.waitIdle',
    title: '等待数据库更新结束',
    description: '轮询等待指定数据集不再更新；超时返回当前状态而不是抛错',
    access: 'read',
    params: objectSchema({
      keys: {
        type: 'array',
        items: { type: 'string', enum: DATASET_KEYS },
        description: '需要等待的数据集，缺省全部',
      },
      timeoutMs: {
        type: 'number',
        default: 120000,
        minimum: 100,
        maximum: 600000,
        description: '超时时间',
      },
      pollMs: {
        type: 'number',
        default: 200,
        minimum: 10,
        maximum: 5000,
        description: '轮询间隔',
      },
    }),
    returns: '{ items: DatasetStatus[], timedOut }',
    examples: [{ title: '等待点位数据库更新结束', params: { keys: ['marker'] } }],
    handler: params =>
      waitForDatasetsIdle(listDatasets(), {
        keys: params.keys as DatasetKey[] | undefined,
        timeoutMs: params.timeoutMs as number | undefined,
        pollMs: params.pollMs as number | undefined,
      }),
  },
]
