import type { BridgeCommand } from '@/ai/types'
import { MapAiError, fail } from '@/ai/errors'
import { objectSchema } from '@/ai/validate'
import { getCapability, getForm, inspectSurface, inspectSurfaces } from '@/ai/bindings'
import { noticeContext } from '@/components/AppNotice/context'
import { useNoticeStore } from '@/stores/notice'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const withTimeout = async <T>(work: Promise<T>, timeoutMs: number, id: string): Promise<T> => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return work
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new MapAiError('E_TIMEOUT', `打开句柄 ${id} 超时`, {
              details: { id, timeoutMs },
            }),
          )
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

const assertAvailable = (id: string) => {
  const capability = getCapability(id)
  if (!capability) {
    if (getForm(id)) {
      fail('E_UNSUPPORTED', `表单 ${id} 已打开但无法通过句柄重新打开`)
    }
    fail('E_UNKNOWN_SURFACE', `页面句柄不存在：${id}`, {
      hint: '调用 ui.surfaces.list 查看当前可用句柄',
    })
  }
  if (capability.enabled && !capability.enabled()) {
    fail('E_FORBIDDEN', `当前账号或状态无法打开句柄：${id}`)
  }
  if (!capability.open) {
    fail('E_UNSUPPORTED', `句柄 ${id} 不支持打开`)
  }
  return capability
}

/** ui.* 命令 */
export const createUiCommands = (): BridgeCommand[] => [
  {
    id: 'ui.surfaces.list',
    title: '列出页面句柄',
    description: '列出当前已注册的弹窗、窗口、弹层、面板与表单句柄',
    access: 'read',
    params: objectSchema({
      kind: {
        type: 'string',
        enum: ['dialog', 'window', 'popover', 'panel', 'form'],
        description: '按类型过滤',
      },
      includeState: {
        type: 'boolean',
        default: true,
        description: '是否读取句柄状态',
      },
    }),
    returns: '{ items: SurfaceInfo[] }',
    examples: [{ title: '列出所有句柄' }],
    handler: params => ({
      items: inspectSurfaces({
        kind: params.kind as 'dialog' | 'window' | 'popover' | 'panel' | 'form' | undefined,
        includeState: params.includeState as boolean | undefined,
      }),
    }),
  },
  {
    id: 'ui.surfaces.get',
    title: '读取单个页面句柄',
    description: '读取指定句柄的可用性、打开状态与内部状态',
    access: 'read',
    params: objectSchema({ id: { type: 'string', description: '句柄 id' } }, ['id']),
    returns: 'SurfaceInfo',
    examples: [{ title: '读取设置弹窗状态', params: { id: 'settings' } }],
    handler: params => {
      const info = inspectSurface(params.id as string)
      if (!info) {
        fail('E_UNKNOWN_SURFACE', `页面句柄不存在：${params.id as string}`)
      }
      return info
    },
  },
  {
    id: 'ui.surfaces.open',
    title: '打开页面句柄',
    description: '按 id 打开弹窗/窗口/弹层/面板；返回是否已进入当前弹窗或仍在排队',
    access: 'read',
    params: objectSchema(
      {
        id: { type: 'string', description: '句柄 id' },
        params: {
          type: 'object',
          additionalProperties: true,
          description: '传给句柄的打开参数',
        },
        timeoutMs: {
          type: 'number',
          default: 15000,
          minimum: 0,
          maximum: 300000,
          description: '打开超时时间',
        },
      },
      ['id'],
    ),
    returns: '{ id, opened, queued, sinceSeq }',
    examples: [
      {
        title: '打开设置并定位数据库页签',
        params: { id: 'settings', params: { section: 'database' } },
      },
      { title: '打开点位弹窗', params: { id: 'markerPopover', params: { markerId: 123 } } },
    ],
    handler: async (params, context) => {
      const id = params.id as string
      const capability = assertAvailable(id)
      const sinceSeq = context.currentSeq()
      const result = await withTimeout(
        Promise.resolve(capability.open!(params.params)),
        Number(params.timeoutMs ?? 15000),
        id,
      )
      const info = inspectSurface(id)
      const opened =
        typeof info?.open === 'boolean' ? info.open : isRecord(result) && result.opened === true
      const queued =
        (isRecord(result) && result.queued === true)
        || (isRecord(info?.state) && info.state.queued === true)
      context.emit('surface:open', { id, queued })
      return { id, opened, queued, sinceSeq }
    },
  },
  {
    id: 'ui.surfaces.close',
    title: '关闭页面句柄',
    description: '按 id 关闭弹窗/窗口/弹层/面板',
    access: 'read',
    params: objectSchema({ id: { type: 'string', description: '句柄 id' } }, ['id']),
    returns: '{ id, closed }',
    examples: [{ title: '关闭设置弹窗', params: { id: 'settings' } }],
    handler: (params, context) => {
      const id = params.id as string
      const capability = getCapability(id)
      if (!capability) {
        if (getForm(id)) fail('E_UNSUPPORTED', `表单 ${id} 不支持通过句柄关闭，请使用 forms.close`)
        fail('E_UNKNOWN_SURFACE', `页面句柄不存在：${id}`)
      }
      if (!capability.close) {
        fail('E_UNSUPPORTED', `句柄 ${id} 不支持关闭`)
      }
      capability.close()
      context.emit('surface:close', { id })
      return { id, closed: true }
    },
  },
  {
    id: 'ui.notices.list',
    title: '公告列表',
    description: '读取公告列表与未读状态',
    access: 'read',
    params: objectSchema({}),
    returns: '{ unread, total, items }',
    handler: () => {
      const noticeStore = useNoticeStore()
      const list = (noticeStore.noticeList ?? []) as Array<Record<string, unknown>>
      return {
        unread: noticeStore.newCount,
        total: list.length,
        visible: Boolean(noticeContext.visible.value),
        items: list.map(notice => ({
          id: notice.id,
          title: notice.title,
          content: notice.content,
          updateTime: notice.updateTime,
          sortIndex: notice.sortIndex,
          isRead: noticeStore.isRead(notice.id as number),
        })),
      }
    },
  },
  {
    id: 'ui.notices.read',
    title: '标记公告已读',
    description: '将指定公告标记为已读',
    access: 'write',
    params: objectSchema({ id: { type: 'number', description: '公告 id' } }, ['id']),
    returns: '{ id, read }',
    handler: params => {
      const id = params.id as number
      const noticeStore = useNoticeStore()
      if (!noticeStore.noticeIdMap.has(id)) {
        fail('E_NOT_FOUND', `公告不存在：${id}`)
      }
      noticeStore.read(id)
      return { id, read: noticeStore.isRead(id) }
    },
  },
]
