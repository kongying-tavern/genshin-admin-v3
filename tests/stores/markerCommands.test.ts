import type { MarkerCommand } from '@/stores/mapEntitySync/model'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError } from '@/api/alova'
import { MarkerCreateUnconfirmed, sendMarkerCreate } from '@/stores/mapEntitySync/markerCommands'

const mocks = vi.hoisted(() => ({
  records: new Map<string, MarkerCommand>(),
  post: vi.fn(),
}))

vi.mock('@/api/alova', () => ({
  default: { marker: { createMarker: mocks.post } },
  ApiResponseError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly business = false,
    ) {
      super(message)
    }
  },
}))

vi.mock('@/database', () => ({
  default: {
    transaction: async (_mode: string, _table: unknown, work: () => Promise<unknown>) => work(),
    mapMarkerCommand: {
      get: async (key: [string, string]) => mocks.records.get(key.join('/')),
      add: async (record: MarkerCommand) =>
        mocks.records.set([record.scope, record.key].join('/'), record),
      put: async (record: MarkerCommand) =>
        mocks.records.set([record.scope, record.key].join('/'), record),
      update: async (key: [string, string], changes: Partial<MarkerCommand>) => {
        const record = mocks.records.get(key.join('/'))
        if (record) mocks.records.set(key.join('/'), { ...record, ...changes })
      },
      delete: async (key: [string, string]) => mocks.records.delete(key.join('/')),
    },
  },
}))

const sync = {
  assertCurrent: () => undefined,
  reportError: () => undefined,
}
const session = { scope: 'user-scope', tail: Promise.resolve() }
const draft = { markerTitle: '点位', position: '1,2' }

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  mocks.post.mockReset()
  mocks.records.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('点位创建持久回执', () => {
  it('请求超时后保留草稿并拦截对同一草稿的再次 POST', async () => {
    mocks.post.mockRejectedValueOnce(new TypeError('网络错误'))
    await expect(
      sendMarkerCreate(sync, session, { ...draft, picture: 'first' }),
    ).rejects.toBeInstanceOf(MarkerCreateUnconfirmed)
    await expect(
      sendMarkerCreate(sync, session, { ...draft, picture: 'retry' }),
    ).rejects.toBeInstanceOf(MarkerCreateUnconfirmed)
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect([...mocks.records.values()][0]).toMatchObject({ status: 'unknown', draft })
  })

  it('保留已确认的服务端 ID，后续恢复使用原回执', async () => {
    mocks.post.mockResolvedValueOnce({ data: 44 })
    const accepted = await sendMarkerCreate(sync, session, draft)
    expect(accepted).toMatchObject({ markerId: 44, status: 'accepted' })
    expect(await sendMarkerCreate(sync, session, draft)).toEqual(accepted)
    expect(mocks.post).toHaveBeenCalledTimes(1)
  })

  it('服务端明确拒绝时允许修改后再次提交', async () => {
    mocks.post.mockRejectedValueOnce(new ApiResponseError('服务端明确拒绝', 422))
    await expect(sendMarkerCreate(sync, session, draft)).rejects.toThrow('服务端明确拒绝')
    expect(mocks.records.size).toBe(0)
    mocks.post.mockResolvedValueOnce({ data: 45 })
    expect((await sendMarkerCreate(sync, session, draft)).markerId).toBe(45)
  })
})
