import { describe, expect, it } from 'vitest'
import { rawRequest } from '../_support/client'
import { track } from '../_support/cleanup'
import { testPrefix } from '../_support/env'
import { capture } from '../_support/observer'
import { login } from '../_support/session'
import { collectWsEvents } from '../_support/ws'

/**
 * ⑧ WebSocket 服务可用性与握手鉴权（对 07 REST→WS 事件联动的前置补充）
 *
 * 已由独立探测确认：Java 的 /ws/ 可建立 socket.io 连接（带/不带 token 均 connected），
 * Rust 的 /ws/ 返回 501 Not Implemented，两种握手都失败。
 * 这里把该结论转成可复跑、带 env 溯源的正式观测，失败一律如实记录、不跳过。
 */
const tag = `${Date.now().toString(36)}`
const areaName = `${testPrefix}ws_probe_${tag}`
const areaCode = `C:${testPrefix.toUpperCase()}WS${tag.toUpperCase()}`

describe('parity / WebSocket 握手与服务可用性', () => {
  it('ws.endpoint.probe：Engine.IO polling 握手端点', async () => {
    const input = await capture('ws.endpoint.probe', ['ws-event', 'status-code', 'headers'], async () => ({
      res: await rawRequest({ method: 'GET', path: '/ws/?EIO=4&transport=polling' }),
      method: 'GET',
      path: '/ws/?EIO=4&transport=polling',
      authMode: 'none',
      note: 'Java 返回 400 Bad Request（握手机制存在）；Rust 返回 501 Not Implemented（WS 服务未实现）',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('ws.handshake.with-token：携带 access token 的握手', async () => {
    const session = await login()
    const res = await rawRequest({ method: 'GET', path: '/system/role/list', token: session.accessToken })
    const ws = await collectWsEvents({
      token: session.accessToken,
      userId: String(session.userId),
      settleMs: 600,
      action: async () => {},
    })
    const input = await capture('ws.handshake.with-token', ['ws-event', 'auth'], async () => ({
      res,
      method: 'GET',
      path: '/system/role/list',
      authMode: 'bearer-valid',
      ws,
      note: 'src/stores/socket/hooks/useSocket.ts:58 注释称 Rust WS_AUTH_REQUIRED 要求带 token；该注释仅作线索，以实测为准',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('ws.handshake.without-token：不带 token 的握手', async () => {
    const session = await login()
    const res = await rawRequest({ method: 'GET', path: '/system/role/list', token: session.accessToken })
    const ws = await collectWsEvents({
      userId: String(session.userId),
      settleMs: 600,
      action: async () => {},
    })
    const input = await capture('ws.handshake.without-token', ['ws-event', 'auth'], async () => ({
      res,
      method: 'GET',
      path: '/system/role/list',
      authMode: 'bearer-valid',
      ws,
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('ws.rest-area-create：REST 写操作期间采集 WS 事件', async () => {
    const session = await login()
    let created = await rawRequest({ method: 'GET', path: '/system/role/list', token: session.accessToken })
    const body = {
      name: areaName,
      code: areaCode,
      parentId: -1,
      sortIndex: 0,
      isFinal: true,
    }

    const ws = await collectWsEvents({
      token: session.accessToken,
      userId: String(session.userId),
      settleMs: 1_200,
      action: async () => {
        created = await rawRequest({
          method: 'PUT',
          path: '/api/area/add',
          token: session.accessToken,
          body,
        })
        const id = created.body?.data
        if (typeof id === 'number') track('area', id)
      },
    })

    const input = await capture('ws.rest-area-create', ['ws-event', 'business-invariant', 'response-schema'], async () => ({
      res: created,
      method: 'PUT',
      path: '/api/area/add',
      body,
      authMode: 'bearer-valid',
      ws,
      note: '采集 REST 写操作是否触发 WS 广播；创建地区已登记清理',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })
})
