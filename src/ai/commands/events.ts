import type { BridgeCommand } from '@/ai/types'
import type { EventLog } from '@/ai/events'
import { objectSchema } from '@/ai/validate'

/** events.* 命令 */
export const createEventCommands = (eventLog: EventLog): BridgeCommand[] => [
  {
    id: 'events.list',
    title: '事件列表',
    description: '读取桥接事件环形缓冲（命令结束、句柄开关、表单结果、数据更新、登录、Socket 等）',
    access: 'read',
    params: objectSchema({
      afterSeq: { type: 'number', default: 0, description: '只返回该序号之后的事件' },
      limit: {
        type: 'number',
        default: 100,
        minimum: 1,
        maximum: 300,
        description: '最多返回条数（取最新 N 条）',
      },
      type: { type: 'string', description: '按事件类型过滤' },
    }),
    returns: 'EventRecord[]',
    examples: [{ title: '查看最近 20 条事件', params: { limit: 20 } }],
    handler: params =>
      eventLog.list({
        afterSeq: params.afterSeq as number | undefined,
        limit: params.limit as number | undefined,
        type: params.type as string | undefined,
      }),
  },
  {
    id: 'events.waitFor',
    title: '等待事件',
    description: '等待指定类型的事件；match 对 payload 做子集匹配，sinceSeq 可查历史缓冲',
    access: 'read',
    params: objectSchema(
      {
        type: { type: 'string', description: '事件类型' },
        match: {
          type: 'object',
          additionalProperties: true,
          description: 'payload 子集匹配',
        },
        sinceSeq: {
          type: 'number',
          description: '只查该序号之后的事件；缺省只等未来事件',
        },
        timeoutMs: {
          type: 'number',
          default: 15000,
          minimum: 0,
          maximum: 300000,
          description: '超时时间',
        },
      },
      ['type'],
    ),
    returns: 'EventRecord',
    examples: [
      {
        title: '等待点位数据库更新结束',
        params: { type: 'dataset:update-end', match: { key: 'marker' }, timeoutMs: 120000 },
      },
    ],
    handler: params =>
      eventLog.waitFor({
        type: params.type as string,
        match: params.match,
        sinceSeq: params.sinceSeq as number | undefined,
        timeoutMs: params.timeoutMs as number | undefined,
      }),
  },
]
