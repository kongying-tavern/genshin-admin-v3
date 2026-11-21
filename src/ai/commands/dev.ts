import type { BridgeCommand } from '@/ai/types'
import { toValue } from 'vue'
import { objectSchema } from '@/ai/validate'
import { useDevStore } from '@/stores/dev'

/** dev.* 命令 */
export const createDevCommands = (): BridgeCommand[] => [
  {
    id: 'dev.logs',
    title: 'Logger 日志',
    description: '读取设置→开发者中可见的 Logger 日志（按时间倒序，最多 200 条）',
    access: 'read',
    params: objectSchema({
      limit: { type: 'number', default: 50, minimum: 1, maximum: 200 },
      label: { type: 'string', description: '按 Logger 标签过滤' },
    }),
    returns: '{ total, items }',
    handler: params => {
      const devStore = useDevStore()
      const limit = Number(params.limit ?? 50)
      const label = params.label as string | undefined
      const list = toValue(devStore.logList) as Array<{
        label: string
        isWorker: boolean
        type: string
        timestamp: number
        args: unknown[]
      }>
      const filtered = label ? list.filter(item => item.label === label) : list
      return {
        total: filtered.length,
        items: filtered.slice(-limit).map(item => ({
          timestamp: item.timestamp,
          label: item.label,
          type: item.type,
          isWorker: item.isWorker,
          args: item.args,
        })),
      }
    },
  },
  {
    id: 'dev.clearLogs',
    title: '清空日志',
    description: '清空 Logger 日志与控制台',
    access: 'write',
    params: objectSchema({}),
    returns: '{ cleared }',
    handler: () => {
      useDevStore().clearLogs()
      return { cleared: true }
    },
  },
]
