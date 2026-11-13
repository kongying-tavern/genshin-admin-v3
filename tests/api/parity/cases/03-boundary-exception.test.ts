import { describe, expect, it } from 'vitest'
import { rawRequest } from '../_support/client'
import { track } from '../_support/cleanup'
import { testPrefix } from '../_support/env'
import { capture } from '../_support/observer'
import { getToken } from '../_support/session'

/**
 * ③ 空值与边界入参 / 异常场景
 *
 * 覆盖：缺字段、空串、null、超长字符串、重复值、极值、空数组；
 *       不存在的 ID、重复创建、业务冲突、版本过期、错误 pathParams 类型。
 * 绝大多数用例只读、零副作用；少数写操作全部以 testPrefix 命名，
 * 且仅对「成功创建的实体」调用 track 登记，由 setup.ts 的全局 afterAll 统一回收。
 * 两套后端共享数据库，但 testPrefix 含各自 runId，两端数据天然隔离。
 */

describe('parity / 空值边界与异常', () => {
  // ---- 空值与边界入参（全部只读）----
  it('boundary.area.list.empty-body', async () => {
    const token = await getToken()
    const body = {}
    const input = await capture('boundary.area.list.empty-body', ['null-boundary', 'request-params'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: '空 JSON 对象：缺失 parentId 与 isTraverse',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.area.list.null-fields', async () => {
    const token = await getToken()
    const body = { parentId: null, isTraverse: null }
    const input = await capture('boundary.area.list.null-fields', ['null-boundary', 'request-params'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: '字段显式为 null',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.area.list.empty-string', async () => {
    const token = await getToken()
    const body = { parentId: '', isTraverse: '' }
    const input = await capture('boundary.area.list.empty-string', ['null-boundary', 'request-params'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: '字段为空字符串',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.area.list.oversize-string', async () => {
    const token = await getToken()
    const body = { parentId: 'x'.repeat(4096), isTraverse: false }
    const input = await capture('boundary.area.list.oversize-string', ['null-boundary', 'exception'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: 'parentId 为 4096 字符超长字符串；快照只记录 body 结构，不落盘原值',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.area.list.extreme-number', async () => {
    const token = await getToken()
    const body = { parentId: Number.MAX_SAFE_INTEGER, isTraverse: false }
    const input = await capture('boundary.area.list.extreme-number', ['null-boundary', 'exception'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: 'parentId 为极大整数 Number.MAX_SAFE_INTEGER',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.area.list.duplicate-array', async () => {
    const token = await getToken()
    const body = { parentId: [-1, -1, -1], isTraverse: false }
    const input = await capture('boundary.area.list.duplicate-array', ['null-boundary', 'request-params'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: '重复值数组作为标量字段入参',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.area.list.empty-array', async () => {
    const token = await getToken()
    const body = { parentId: [], isTraverse: false }
    const input = await capture('boundary.area.list.empty-array', ['null-boundary', 'request-params'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: '空数组作为标量字段入参',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.marker.byid.empty-array', async () => {
    const token = await getToken()
    const body: unknown[] = []
    const input = await capture('boundary.marker.byid.empty-array', ['null-boundary', 'request-params'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/list_byid', body, token }),
      method: 'POST',
      path: '/api/marker/get/list_byid',
      body,
      authMode: 'bearer-valid',
      note: '按 id 批量查询传入空数组',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.marker.byid.null-body', async () => {
    const token = await getToken()
    const input = await capture('boundary.marker.byid.null-body', ['null-boundary', 'exception'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/list_byid', body: null, token }),
      method: 'POST',
      path: '/api/marker/get/list_byid',
      body: null,
      authMode: 'bearer-valid',
      note: '请求体显式为 null（JSON null）',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.item.byid.empty-array', async () => {
    const token = await getToken()
    const body: unknown[] = []
    const input = await capture('boundary.item.byid.empty-array', ['null-boundary', 'request-params'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/item/get/list_byid', body, token }),
      method: 'POST',
      path: '/api/item/get/list_byid',
      body,
      authMode: 'bearer-valid',
      note: '按 id 批量查询传入空数组',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ---- 异常：不存在的 ID / 错误 pathParams 类型 / 业务冲突（只读）----
  it('boundary.area.get.nonexistent-id', async () => {
    const token = await getToken()
    const input = await capture('boundary.area.get.nonexistent-id', ['exception', 'error-code'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/999999999', token }),
      method: 'POST',
      path: '/api/area/get/{areaId}',
      authMode: 'bearer-valid',
      note: '查询不存在的地区 id，采集业务错误码',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.area.get.bad-pathparam-type', async () => {
    const token = await getToken()
    const input = await capture('boundary.area.get.bad-pathparam-type', ['exception', 'status-code'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/not-a-number', token }),
      method: 'POST',
      path: '/api/area/get/{areaId}',
      authMode: 'bearer-valid',
      note: 'pathParams 传入非数字字符串，观察类型转换失败时的状态码',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.area.get.negative-id', async () => {
    const token = await getToken()
    const input = await capture('boundary.area.get.negative-id', ['exception', 'error-code'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/-1', token }),
      method: 'POST',
      path: '/api/area/get/{areaId}',
      authMode: 'bearer-valid',
      note: 'pathParams 为负数极值 id',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.icon.single.nonexistent-id', async () => {
    const token = await getToken()
    const input = await capture('boundary.icon.single.nonexistent-id', ['exception', 'error-code'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/icon/get/single/999999999', token }),
      method: 'POST',
      path: '/api/icon/get/single/{iconId}',
      authMode: 'bearer-valid',
      note: '查询不存在的图标 id（Java 基线 data 为 null 而非业务错误）',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.marker.search.condition-conflict', async () => {
    const token = await getToken()
    const body = { areaIdList: [-1], itemIdList: [999999999] }
    const input = await capture('boundary.marker.search.condition-conflict', ['exception', 'error-code'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/get/id', body, token }),
      method: 'POST',
      path: '/api/marker/get/id',
      body,
      authMode: 'bearer-valid',
      note: '同时传入地区与物品两类互斥筛选条件，触发「条件冲突」业务错误',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.item.byid.nonexistent-ids', async () => {
    const token = await getToken()
    const body = [999999999]
    const input = await capture('boundary.item.byid.nonexistent-ids', ['exception', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/item/get/list_byid', body, token }),
      method: 'POST',
      path: '/api/item/get/list_byid',
      body,
      authMode: 'bearer-valid',
      note: '批量查询不存在的物品 id，观察空结果集结构',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ---- 异常：重复创建 / 缺字段创建 / 版本过期（写操作，testPrefix + track）----
  it('boundary.user.register.duplicate', async () => {
    const token = await getToken()
    const username = `${testPrefix}dupuser`
    const password = 'parityTest123456'
    const setup = await rawRequest({ method: 'POST', path: '/system/user/register', body: { username, password }, token })
    const userId = setup.body?.data
    if (typeof userId === 'number') track('user', userId)

    const input = await capture('boundary.user.register.duplicate', ['exception', 'error-code'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/system/user/register', body: { username, password }, token }),
      method: 'POST',
      path: '/system/user/register',
      body: 'JSON(username=<testPrefix>,password=<masked>)',
      authMode: 'bearer-valid',
      note: '前置同名注册成功实体已 track 清理；本条观测第二次同名注册的「用户已存在」业务冲突；凭据不落盘',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.area.create.missing-name', async () => {
    const token = await getToken()
    const body = { code: `${testPrefix}NO_NAME`, parentId: -1, sortIndex: 0 }
    const input = await capture('boundary.area.create.missing-name', ['null-boundary', 'error-code'], async () => ({
      res: await rawRequest({ method: 'PUT', path: '/api/area/add', body, token }),
      method: 'PUT',
      path: '/api/area/add',
      body: 'JSON(code=<testPrefix>,parentId,sortIndex) 缺 name',
      authMode: 'bearer-valid',
      note: '缺失必填字段 name 的创建请求；若意外创建成功，成功实体会登记清理',
    }))
    const createdId = input.res.body?.data
    if (typeof createdId === 'number') track('area', createdId)
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('boundary.marker.version.stale', async () => {
    const token = await getToken()
    const title = `${testPrefix}stale-version-marker`
    const createBody = {
      markerTitle: title,
      position: '1.5,2.5',
      content: 'parity',
      refreshTime: 0,
      hiddenFlag: 0,
      extra: {},
      itemList: [],
    }
    const setup = await rawRequest({ method: 'PUT', path: '/api/marker/single', body: createBody, token })
    const markerId = setup.body?.data
    if (typeof markerId === 'number') track('marker', markerId)

    const updateBody = {
      id: typeof markerId === 'number' ? markerId : 1,
      version: 999999,
      markerTitle: title,
      position: '1.5,2.5',
      content: 'parity-stale',
      refreshTime: 0,
      extra: {},
      itemList: [],
    }
    const input = await capture('boundary.marker.version.stale', ['exception', 'error-code'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/marker/single', body: updateBody, token }),
      method: 'POST',
      path: '/api/marker/single',
      body: 'JSON(id,version=999999,...) 过期版本号',
      authMode: 'bearer-valid',
      note: '前置创建点位已 track 清理；本条观测使用明显过期 version 更新时的乐观锁冲突响应',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })
})
