import { describe, expect, it } from 'vitest'
import { rawRequest } from '../_support/client'
import type { RawResult } from '../_support/client'
import { track } from '../_support/cleanup'
import { testPrefix } from '../_support/env'
import { capture } from '../_support/observer'
import { login } from '../_support/session'
import { collectWsEvents } from '../_support/ws'

/**
 * ⑦ REST → WebSocket 联动：在真实 WS 连接下执行 REST 写操作并采集广播事件。
 *
 * 前端订阅方式（src/worker/webSocket/socket.worker.ts:150-154）：监听 `message` 通道，
 * JSON.parse 后按 { event, data, time } 还原。这里直连 VITE_WS_BASE，全部事件来自真实后端推送，
 * 不使用任何模拟事件 / mock / msw。
 *
 * 口径：Java 实测即唯一基准。用例内只做「响应来自真实后端」的自洽断言，不写跨环境断言、
 * 不 skip；WS 连接失败（connectError）由 collectWsEvents 如实记入 ws 字段，绝不跳过。
 * 两套后端共享同一个数据库：所有创建数据以 testPrefix 命名并 track(type, id) 登记回收。
 *
 * caseId 统一用 `ws.events.*` 前缀：与 08-ws-handshake.test.ts 的 `ws.*`（握手探活）区分，
 * 避免同名快照互相覆盖（diff 按 caseId 聚合）。
 */
describe('parity / REST→WS 联动', () => {
  let seq = 0
  const uniq = () => `${Date.now().toString(36)}_${seq++}`
  const codeTag = () => `${testPrefix}${uniq()}`.toUpperCase().replace(/[^A-Z0-9_.-]/g, '')

  const areaBody = () => ({
    name: `${testPrefix}area_${uniq()}`,
    code: `C:${codeTag()}`,
    parentId: -1,
    sortIndex: 0,
  })

  const createArea = async (token: string) => {
    const body = areaBody()
    const res = await rawRequest({ method: 'PUT', path: '/api/area/add', token, body })
    const id = res.body?.data
    if (typeof id === 'number') track('area', id)
    return typeof id === 'number' ? id : -1
  }

  const createItem = async (token: string, areaId: number) => {
    const body = {
      name: `${testPrefix}item_${uniq()}`,
      areaId,
      defaultCount: 1,
      defaultRefreshTime: 0,
      defaultContent: '',
      iconStyleType: 0,
      hiddenFlag: 0,
      sortIndex: 0,
      specialFlag: 0,
    }
    const res = await rawRequest({ method: 'PUT', path: '/api/item/add', token, body })
    const id = res.body?.data
    if (typeof id === 'number') track('item', id)
    return typeof id === 'number' ? id : -1
  }

  const markerBody = (itemId: number) => ({
    markerTitle: `${testPrefix}marker_${uniq()}`,
    position: '100.5,200.5',
    content: `${testPrefix}content`,
    refreshTime: 0,
    hiddenFlag: 0,
    extra: {},
    itemList: [{ itemId, count: 1 }],
  })

  /** 前置创建点位（在 WS 连接之外，不污染事件采集窗口） */
  const createMarker = async (token: string, itemId: number) => {
    const body = markerBody(itemId)
    const res = await rawRequest({ method: 'PUT', path: '/api/marker/single', token, body })
    const id = res.body?.data
    if (typeof id === 'number') track('marker', id)
    return { id: typeof id === 'number' ? id : -1, body }
  }

  const readMarkerVersion = async (token: string, markerId: number) => {
    const res = await rawRequest({
      method: 'POST',
      path: '/api/marker/get/list_byid',
      token,
      body: { markerIdList: [markerId] },
    })
    const list = Array.isArray(res.body?.data) ? res.body.data : []
    const version = list[0]?.version
    return typeof version === 'number' ? version : 0
  }

  /** 构造一条完整「地区 → 物品 → 两个点位」链路，供关联类用例复用 */
  const createLinkFixture = async (token: string) => {
    const areaId = await createArea(token)
    const itemId = await createItem(token, areaId)
    const a = await createMarker(token, itemId)
    const b = await createMarker(token, itemId)
    return { itemId, a, b }
  }

  /** 前置建组（在 WS 连接之外），返回后端生成或占位的 groupId */
  const createLinkGroup = async (token: string, fromId: number, toId: number) => {
    const groupId = `${testPrefix}grp_${uniq()}`
    const body = [{ groupId, fromId, toId, linkAction: 'RELATED', linkReverse: false }]
    const res = await rawRequest({ method: 'POST', path: '/api/marker_link/link', token, body })
    const returned = res.body?.data
    const effective = typeof returned === 'string' && returned ? returned : groupId
    track('linkage', effective, effective)
    return effective
  }

  // ============================== 握手 ==============================

  it('ws.handshake.with-token：携带 token 握手并在连接下执行 REST 写', async () => {
    const { accessToken: token, userId } = await login()
    const body = areaBody()
    const input = await capture('ws.events.handshake.with-token', ['ws-event', 'auth', 'business-invariant'], async () => {
      let res!: RawResult
      const ws = await collectWsEvents({
        token,
        userId: String(userId),
        settleMs: 1500,
        action: async () => {
          res = await rawRequest({ method: 'PUT', path: '/api/area/add', token, body })
          const id = res.body?.data
          if (typeof id === 'number') track('area', id)
        },
      })
      return {
        res,
        method: 'PUT',
        path: '/api/area/add',
        body,
        authMode: 'bearer-valid',
        ws,
        note: '握手携带 token（with-token），对齐前端 useSocket.ts:56-67 的 query { userId, token }。待核实：useSocket.ts:58 注释称 Rust WS_AUTH_REQUIRED 要求 token、Java 未必要求，该注释仅作线索，connected/connectError 须以真实 WS 采集为准；connectError 不跳过、如实记录。地区创建可能不广播任何 marker 事件，事件集如实采集。',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('ws.handshake.without-token：不带 token 握手并在连接下执行 REST 写', async () => {
    const { accessToken: token, userId } = await login()
    const body = areaBody()
    const input = await capture('ws.events.handshake.without-token', ['ws-event', 'auth'], async () => {
      let res!: RawResult
      const ws = await collectWsEvents({
        userId: String(userId),
        settleMs: 1500,
        action: async () => {
          res = await rawRequest({ method: 'PUT', path: '/api/area/add', token, body })
          const id = res.body?.data
          if (typeof id === 'number') track('area', id)
        },
      })
      return {
        res,
        method: 'PUT',
        path: '/api/area/add',
        body,
        authMode: 'bearer-valid',
        ws,
        note: '握手不带 token（without-token），仅 query { userId }。待核实：Java 是否要求 WS 握手 token（useSocket.ts:58 称 Rust WS_AUTH_REQUIRED 要求 token、Java 未必要求）；若 Rust 侧 connectError，如实记录、不得跳过。REST 写仍携带有效 token，故 res 必为真实响应。',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ============================== 点位增 / 改 / 删 ==============================

  it('ws.marker.added：PUT /api/marker/single 期望 MarkerAdded', async () => {
    const { accessToken: token, userId } = await login()
    const input = await capture('ws.events.marker.added', ['ws-event', 'business-invariant'], async () => {
      const areaId = await createArea(token)
      const itemId = await createItem(token, areaId)
      const body = markerBody(itemId)
      let res!: RawResult
      const ws = await collectWsEvents({
        token,
        userId: String(userId),
        settleMs: 1500,
        action: async () => {
          res = await rawRequest({ method: 'PUT', path: '/api/marker/single', token, body })
          const id = res.body?.data
          if (typeof id === 'number') track('marker', id)
        },
      })
      return {
        res,
        method: 'PUT',
        path: '/api/marker/single',
        body,
        authMode: 'bearer-valid',
        ws,
        note: '期望事件 MarkerAdded（src/api/ws/typings.d.ts:69，@data 点位 id）。前置地区/物品在 WS 连接之外创建，事件采集窗口内仅含本次 PUT 触发的广播。点位载荷参考 tests/api/_support/factories.ts:212-228。实际事件名与 payload 以真实采集为准。',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('ws.marker.updated：POST /api/marker/single 期望 MarkerUpdated', async () => {
    const { accessToken: token, userId } = await login()
    const input = await capture('ws.events.marker.updated', ['ws-event', 'business-invariant'], async () => {
      const areaId = await createArea(token)
      const itemId = await createItem(token, areaId)
      const marker = await createMarker(token, itemId)
      const version = await readMarkerVersion(token, marker.id)
      const body = {
        id: marker.id,
        version,
        markerTitle: marker.body.markerTitle,
        position: '1.5,2.5',
        content: `${testPrefix}updated`,
        refreshTime: 0,
        extra: {},
        itemList: [{ itemId, count: 1 }],
      }
      let res!: RawResult
      const ws = await collectWsEvents({
        token,
        userId: String(userId),
        settleMs: 1500,
        action: async () => {
          res = await rawRequest({ method: 'POST', path: '/api/marker/single', token, body })
        },
      })
      return {
        res,
        method: 'POST',
        path: '/api/marker/single',
        body,
        authMode: 'bearer-valid',
        ws,
        note: '期望事件 MarkerUpdated（src/api/ws/typings.d.ts:75，@data 点位 id）。前置点位创建与 version 读取均在 WS 连接之外完成，更新需携带 version + extra（marker.test.ts:25-26 说明 extra 为 null 会空指针）。实际事件名与 payload 以真实采集为准。',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('ws.marker.deleted：DELETE /api/marker/{markerId} 期望 MarkerDeleted', async () => {
    const { accessToken: token, userId } = await login()
    const input = await capture('ws.events.marker.deleted', ['ws-event', 'business-invariant'], async () => {
      const areaId = await createArea(token)
      const itemId = await createItem(token, areaId)
      const marker = await createMarker(token, itemId)
      let res!: RawResult
      const ws = await collectWsEvents({
        token,
        userId: String(userId),
        settleMs: 1500,
        action: async () => {
          res = await rawRequest({ method: 'DELETE', path: `/api/marker/${marker.id}`, token })
        },
      })
      return {
        res,
        method: 'DELETE',
        path: `/api/marker/${marker.id}`,
        authMode: 'bearer-valid',
        ws,
        note: '期望事件 MarkerDeleted（src/api/ws/typings.d.ts:81，@data 点位 id）。前置点位在 WS 连接之外创建；删除后仍 track，cleanup 再删视为 already-gone。实际事件名与 payload 以真实采集为准。',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ============================== 点位关联 / 删除关联 ==============================

  it('ws.marker.linked：POST /api/marker_link/link 期望 MarkerLinked', async () => {
    const { accessToken: token, userId } = await login()
    const input = await capture('ws.events.marker.linked', ['ws-event', 'business-invariant'], async () => {
      const { a, b } = await createLinkFixture(token)
      const body = [{ groupId: `${testPrefix}grp_${uniq()}`, fromId: a.id, toId: b.id, linkAction: 'RELATED', linkReverse: false }]
      let res!: RawResult
      const ws = await collectWsEvents({
        token,
        userId: String(userId),
        settleMs: 1500,
        action: async () => {
          res = await rawRequest({ method: 'POST', path: '/api/marker_link/link', token, body })
          const returned = res.body?.data
          const gid = typeof returned === 'string' && returned ? returned : (body[0].groupId as string)
          track('linkage', gid, gid)
        },
      })
      return {
        res,
        method: 'POST',
        path: '/api/marker_link/link',
        body,
        authMode: 'bearer-valid',
        ws,
        note: '期望事件 MarkerLinked（src/api/ws/typings.d.ts:100，@see WSMarkerLinkData{groups,markers}）。待核实：任务原文写 POST /api/marker/link，按 apiDefinitions.ts:66 正确端点应为 /api/marker_link/link；前端 stores/markerLink.ts:101-108 提交时不含 groupId、由后端生成并在 data 返回 groupId 字符串，此处按任务字段构造。实际事件名与 payload 以真实采集为准。',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('ws.link.deleted：DELETE /api/marker_link/delete 记录实际事件名（契约缺口）', async () => {
    const { accessToken: token, userId } = await login()
    const input = await capture('ws.events.link.deleted', ['ws-event', 'business-invariant'], async () => {
      const { a, b } = await createLinkFixture(token)
      const groupId = await createLinkGroup(token, a.id, b.id)
      const body = { groupIds: [groupId] }
      let res!: RawResult
      const ws = await collectWsEvents({
        token,
        userId: String(userId),
        settleMs: 1500,
        action: async () => {
          res = await rawRequest({ method: 'DELETE', path: '/api/marker_link/delete', token, body })
        },
      })
      return {
        res,
        method: 'DELETE',
        path: '/api/marker_link/delete',
        body,
        authMode: 'bearer-valid',
        ws,
        note: '记录实际广播事件名。契约缺口：Java 源码参考 reference/.../MarkerLinkageController.java:74 声称广播 MarkerLinkageDeleted，但前端 src/api/ws/typings.d.ts:16-133 的 WSEventMap 与 src/stores/types/socket.d.ts:2-12 的 DataEventMap 均未声明该事件（仅声明 MarkerLinked）。本仓库未包含该 Java 参考源码，实际事件名以真实 WS 采集为准（待核实）；删除响应同时采集 LinkDeleteVo{groups,markers}。前置建组在 WS 连接之外完成。',
      }
    })
    expect(input.res.status).toBeGreaterThan(0)
  })
})
