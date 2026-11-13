import { beforeAll, describe, expect, it } from 'vitest'
import { rawRequest } from '../_support/client'
import { track } from '../_support/cleanup'
import { testPrefix } from '../_support/env'
import { capture } from '../_support/observer'
import { getToken, login } from '../_support/session'
import { collectWsEvents } from '../_support/ws'

/**
 * ⑨ 业务不变量 + ⑩ REST → WebSocket 事件联动
 *
 * 基准口径：**Java 实测即基准**，包含其已知「非理想行为」——
 * 允许孤立 parentId、code 重复、删除地区不级联物品、悬空外键等，
 * 均照实采集，不以理想语义断言；业务正确性另见 java-baseline-deviations.md。
 *
 * 两套后端共享同一数据库：所有创建数据以 testPrefix 命名并登记清理。
 */

const tag = `${Date.now().toString(36).toUpperCase()}`
const uniq = (s: string) => `${testPrefix}${s}_${tag}`

type Fixture = {
  rootId: number
  childId: number
  itemId: number
  markerA: number
  markerB: number
  markerAVersion: number
}

let fx: Fixture
let linkGroupId = ''
let linkIds: number[] = []

const createArea = async (body: Record<string, unknown>) => {
  const res = await rawRequest({ method: 'PUT', path: '/api/area/add', token: await getToken(), body })
  const id = res.body?.data
  if (typeof id === 'number') track('area', id)
  if (typeof id !== 'number')
    throw new Error(`[parity] 创建地区失败：status=${res.status} body=${res.bodyText.slice(0, 200)}`)
  return id as number
}

const createItem = async (areaId: number, overrides: Record<string, unknown> = {}) => {
  const res = await rawRequest({
    method: 'PUT', path: '/api/item/add', token: await getToken(),
    body: {
      name: uniq('item'), areaId, defaultCount: 1, defaultRefreshTime: 0,
      defaultContent: '', iconStyleType: 0, hiddenFlag: 0, sortIndex: 0, specialFlag: 0,
      ...overrides,
    },
  })
  const id = res.body?.data
  if (typeof id === 'number') track('item', id)
  return id as number
}

const createMarker = async (itemList: { itemId: number; count: number }[] = []) => {
  const res = await rawRequest({
    method: 'PUT', path: '/api/marker/single', token: await getToken(),
    body: {
      markerTitle: uniq('marker'), position: '100.5,200.5', content: 'parity marker',
      refreshTime: 0, hiddenFlag: 0, extra: {}, itemList,
    },
  })
  const id = res.body?.data
  if (typeof id === 'number') track('marker', id)
  return id as number
}

const observe = async (
  caseId: string, tags: string[], method: string, path: string, body?: unknown, note?: string,
) => {
  const input = await capture(caseId, tags, async () => ({
    res: await rawRequest({ method, path, body, token: await getToken() }),
    method, path, body, authMode: 'bearer-valid', note,
  }))
  expect(input.res.status).toBeGreaterThan(0)
  return input
}

beforeAll(async () => {
  const rootId = await createArea({ name: uniq('root'), code: `C:${tag}ROOT`, parentId: -1, sortIndex: 0, isFinal: true })
  const childId = await createArea({ name: uniq('child'), code: `C:${tag}CHILD`, parentId: rootId, sortIndex: 0 })
  const itemId = await createItem(rootId)
  const markerA = await createMarker([{ itemId, count: 1 }])
  const markerB = await createMarker([{ itemId, count: 1 }])

  const read = await rawRequest({ method: 'POST', path: '/api/marker/get/list_byid', token: await getToken(), body: { markerIdList: [markerA] } })
  const markerAVersion = Number(read.body?.data?.[0]?.version ?? 0)
  fx = { rootId, childId, itemId, markerA, markerB, markerAVersion }
}, 90_000)

describe('parity / 地区树不变量', () => {
  it('invariant.area.isFinal-after-child', async () => {
    await observe('invariant.area.isFinal-after-child', ['business-invariant', 'response-schema'], 'POST', `/api/area/get/${fx.rootId}`, undefined, 'Java 基线：新增子级后父级 isFinal 变为 false（area.test.ts:198）')
  })
  it('invariant.area.tree-direct', async () => {
    await observe('invariant.area.tree-direct', ['business-invariant', 'response-schema'], 'POST', '/api/area/get/list', { parentId: fx.rootId, isTraverse: false })
  })
  it('invariant.area.tree-traverse', async () => {
    await observe('invariant.area.tree-traverse', ['business-invariant', 'response-schema'], 'POST', '/api/area/get/list', { parentId: fx.rootId, isTraverse: true })
  })
  it('invariant.area.ghost-parent：父级不存在（Java 允许悬空）', async () => {
    const ghost = 9_999_999
    await capture('invariant.area.ghost-parent', ['business-invariant', 'exception'], async () => ({
      res: await rawRequest({ method: 'PUT', path: '/api/area/add', token: await getToken(), body: { name: uniq('ghost'), code: `C:${tag}GHOST`, parentId: ghost, sortIndex: 0 } }),
      method: 'PUT', path: '/api/area/add', body: { name: testPrefix, code: testPrefix, parentId: ghost, sortIndex: 0 }, authMode: 'bearer-valid',
      note: 'Java 基线：允许 parentId 指向不存在的父级（area.test.ts:275-289）',
    })).then(input => {
      if (typeof input.res.body?.data === 'number') track('area', input.res.body.data)
      expect(input.res.status).toBeGreaterThan(0)
    })
  })
  it('invariant.area.self-parent：自环被拒', async () => {
    await observe('invariant.area.self-parent', ['business-invariant', 'exception', 'error-code'], 'POST', '/api/area/update', { id: fx.rootId, name: uniq('self'), code: `C:${tag}SELF`, parentId: fx.rootId }, 'Java 基线：parentId 等于自身 id 被拒绝（area.test.ts:141）')
  })
  it('invariant.area.isFinal-override：入参 isFinal 被重算覆盖', async () => {
    await observe('invariant.area.isFinal-override', ['business-invariant', 'request-params'], 'POST', '/api/area/update', { id: fx.rootId, name: uniq('final'), code: `C:${tag}FINAL`, parentId: -1, isFinal: true }, 'Java 基线：服务端按子级数量重算 isFinal，入参被覆盖（area.test.ts:241）')
  })
  it('invariant.area.duplicate-code：重复 code', async () => {
    const code = `C:${tag}DUP`
    await createArea({ name: uniq('dup_a'), code, parentId: -1, sortIndex: 0 })
    await capture('invariant.area.duplicate-code', ['business-invariant', 'exception'], async () => ({
      res: await rawRequest({ method: 'PUT', path: '/api/area/add', token: await getToken(), body: { name: uniq('dup_b'), code, parentId: -1, sortIndex: 0 } }),
      method: 'PUT', path: '/api/area/add', body: { name: testPrefix, code: testPrefix, parentId: -1, sortIndex: 0 }, authMode: 'bearer-valid',
      note: 'Java 基线：code 不唯一，重复 code 不阻止创建（area.test.ts:297-310）',
    })).then(input => {
      if (typeof input.res.body?.data === 'number') track('area', input.res.body.data)
      expect(input.res.status).toBeGreaterThan(0)
    })
  })
})

describe('parity / 跨实体与点位', () => {
  it('invariant.marker.area-derivation', async () => {
    await observe('invariant.marker.area-derivation', ['business-invariant', 'response-schema'], 'POST', '/api/marker/get/id', { areaIdList: [fx.rootId] }, '点位无 areaId，归属由 item.areaId 推导（cross-entity.test.ts:22-26）')
  })
  it('invariant.marker.item-filter', async () => {
    await observe('invariant.marker.item-filter', ['business-invariant', 'request-params'], 'POST', '/api/marker/get/id', { itemIdList: [fx.itemId] })
  })
  it('invariant.marker.conflicting-filters', async () => {
    await observe('invariant.marker.conflicting-filters', ['business-invariant', 'exception', 'error-code'], 'POST', '/api/marker/get/id', { areaIdList: [fx.rootId], itemIdList: [fx.itemId] }, 'Java 基线：同时传两类筛选条件提示条件冲突')
  })
  it('invariant.marker.version-conflict：过期版本号更新被拒', async () => {
    await observe('invariant.marker.version-conflict', ['business-invariant', 'exception', 'error-code'], 'POST', '/api/marker/single', { id: fx.markerA, version: fx.markerAVersion - 1, markerTitle: uniq('stale'), position: '100.5,200.5', itemList: [], extra: {} }, 'Java 基线：使用过期版本号更新被拒绝')
  })
  it('invariant.icon.dangling-ref：删除被引用图标产生悬空外键', async () => {
    const iconRes = await rawRequest({ method: 'PUT', path: '/api/icon/add', token: await getToken(), body: { tag: uniq('icon'), url: 'https://example.test/parity.png', description: 'parity', typeIdList: [] } })
    const iconId = iconRes.body?.data
    if (typeof iconId === 'number') track('icon', iconId)
    await createItem(fx.rootId, { iconId })
    const del = await rawRequest({ method: 'DELETE', path: `/api/icon/delete/${iconId}`, token: await getToken() })
    await capture('invariant.icon.dangling-ref', ['business-invariant', 'exception'], async () => ({
      res: del, method: 'DELETE', path: `/api/icon/delete/${iconId}`, authMode: 'bearer-valid',
      note: 'Java 基线：删除被物品引用的图标不校验引用，物品保留悬空 iconId（cross-entity.test.ts:174-192）',
    }))
    expect(del.status).toBeGreaterThan(0)
  })
})

describe('parity / 点位关联：建组、组内单删、整组裂解', () => {
  it('invariant.link.create', async () => {
    const input = await capture('invariant.link.create', ['business-invariant', 'request-params', 'response-schema'], async () => ({
      res: await rawRequest({
        method: 'POST', path: '/api/marker_link/link', token: await getToken(),
        body: [{ fromId: fx.markerA, toId: fx.markerB, linkAction: 'LINE', linkReverse: false }],
      }),
      method: 'POST', path: '/api/marker_link/link',
      body: [{ fromId: 1, toId: 2, linkAction: 'LINE', linkReverse: false }], authMode: 'bearer-valid',
      note: 'Java 后端 MarkerLinkageController.java:60-68 返回 groupId 并广播 MarkerLinked',
    }))
    if (typeof input.res.body?.data === 'string') linkGroupId = input.res.body.data
    if (linkGroupId) track('linkage', 0, linkGroupId)
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('invariant.link.get-list', async () => {
    const input = await observe('invariant.link.get-list', ['business-invariant', 'response-schema'], 'POST', '/api/marker_link/get/list', { groupIds: linkGroupId ? [linkGroupId] : [], isTraverse: true }, '读取关联组内单条记录 id，供下一步「组内删除单条」使用')
    const data = input.res.body?.data
    if (data && typeof data === 'object') {
      const list = Array.isArray(data) ? data : Object.values(data).flat()
      linkIds = (list as any[]).map(v => Number(v?.id ?? v)).filter(n => Number.isFinite(n))
    }
  })

  it('invariant.link.delete-single：从组内删除单条关联', async () => {
    const ids = linkIds.slice(0, 1)
    await observe('invariant.link.delete-single', ['business-invariant', 'exception', 'error-code'], 'DELETE', '/api/marker_link/delete', { ids }, `LinkDeleteQueryVo.ids = [${ids.join(',')}]；返回 LinkDeleteVo{groups,markers}`)
  })

  it('invariant.link.delete-group：整组删除 / 裂解', async () => {
    await observe('invariant.link.delete-group', ['business-invariant', 'response-schema'], 'DELETE', '/api/marker_link/delete', { groupIds: linkGroupId ? [linkGroupId] : [] }, 'LinkDeleteQueryVo.groupIds；返回受影响的 groups 与 markers 集合')
  })
})

describe('parity / REST → WebSocket 事件联动', () => {
  const withWs = async (
    caseId: string, tags: string[], method: string, path: string,
    build: () => Promise<{ body?: unknown; note?: string }>,
  ) => {
    const session = await login()
    const token = session.accessToken
    let res = await rawRequest({ method: 'GET', path: '/system/role/list', token })
    const ws = await collectWsEvents({
      token, userId: String(session.userId), settleMs: 1_200,
      action: async () => {
        const built = await build()
        res = await rawRequest({ method, path, token, body: built.body })
        const id = res.body?.data
        if (typeof id === 'number') track('marker', id)
      },
    })
    const input = await capture(caseId, tags, async () => ({
      res, method, path, authMode: 'bearer-valid', ws,
      note: 'Java 广播事件名见 MarkerController.java / MarkerLinkageController.java；Rust 侧 /ws/ 为 501，连接失败如实记录',
    }))
    expect(input.res.status).toBeGreaterThan(0)
    return input
  }

  it('ws.marker-added：PUT /api/marker/single → MarkerAdded', async () => {
    await withWs('ws.marker-added', ['ws-event', 'business-invariant'], 'PUT', '/api/marker/single', async () => ({
      body: { markerTitle: uniq('ws_add'), position: '1,2', content: 'parity', refreshTime: 0, hiddenFlag: 0, extra: {}, itemList: [] },
    }))
  })

  it('ws.marker-updated：POST /api/marker/single → MarkerUpdated', async () => {
    await withWs('ws.marker-updated', ['ws-event', 'business-invariant'], 'POST', '/api/marker/single', async () => ({
      body: { id: fx.markerB, version: fx.markerAVersion, markerTitle: uniq('ws_upd'), position: '3,4', itemList: [], extra: {} },
    }))
  })

  it('ws.marker-deleted：DELETE /api/marker/{id} → MarkerDeleted', async () => {
    const tempMarker = await createMarker([])
    await withWs('ws.marker-deleted', ['ws-event', 'business-invariant'], 'DELETE', `/api/marker/${tempMarker}`, async () => ({}))
  })

  it('ws.marker-linked：关联变更的 WS 事件', async () => {
    await withWs('ws.marker-linked', ['ws-event', 'business-invariant'], 'POST', '/api/marker_link/link', async () => ({
      body: [{ fromId: fx.markerA, toId: fx.markerB, linkAction: 'LINE', linkReverse: false }],
      note: 'Java 广播 MarkerLinked / MarkerLinkageDeleted；前端 WSEventMap 未声明 MarkerLinkageDeleted',
    }))
  })
})
