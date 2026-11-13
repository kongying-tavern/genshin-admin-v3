import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rawRequest } from '../_support/client'
import { track, type EntityType } from '../_support/cleanup'
import { testPrefix } from '../_support/env'
import { capture } from '../_support/observer'
import { getToken } from '../_support/session'

/**
 * ② 请求参数 / 响应体字段与类型 / 状态码 / 错误码 / 响应头
 * ③ 空值与边界入参 / 异常
 * ④ 分页与排序
 * ⑤ 端点可达性清单
 *
 * 全部为真实请求，禁止 mock。每条快照带 env / envFile / baseUrl 溯源。
 * 单端只做「拿到真实响应」的自洽断言，Java↔Rust 差异由 diff-report.mjs 以 Java 为基线裁决。
 */

const tag = `${Date.now().toString(36)}`

/** 统一采集器：减少重复代码，并保证每个写操作产生的实体都登记清理 */
const observe = async (
  caseId: string,
  tags: string[],
  method: string,
  path: string,
  body?: unknown,
  note?: string,
  trackedType?: EntityType,
) => {
  const input = await capture(caseId, tags, async () => ({
    res: await rawRequest({ method, path, body, token: await getToken() }),
    method,
    path,
    body,
    authMode: 'bearer-valid',
    note,
  }))
  if (trackedType) {
    const id = input.res.body?.data
    if (typeof id === 'number') track(trackedType, id)
  }
  expect(input.res.status).toBeGreaterThan(0)
  return input
}

describe('parity / 响应体字段与类型 + 响应头', () => {
  it('scenario.schema.role-list', async () => {
    await observe('scenario.schema.role-list', ['response-schema', 'headers', 'status-code'], 'GET', '/system/role/list')
  })
  it('scenario.schema.area-list-traverse', async () => {
    await observe('scenario.schema.area-list-traverse', ['response-schema', 'request-params'], 'POST', '/api/area/get/list', { parentId: -1, isTraverse: true })
  })
  it('scenario.schema.area-list-direct', async () => {
    await observe('scenario.schema.area-list-direct', ['response-schema', 'request-params'], 'POST', '/api/area/get/list', { parentId: -1, isTraverse: false })
  })
  it('scenario.schema.itemtype-list', async () => {
    await observe('scenario.schema.itemtype-list', ['response-schema'], 'POST', '/api/item_type/get/list_all', {})
  })
  it('scenario.schema.icontype-list', async () => {
    await observe('scenario.schema.icontype-list', ['response-schema'], 'POST', '/api/icon_type/get/list', {})
  })
  it('scenario.schema.icon-list', async () => {
    await observe('scenario.schema.icon-list', ['response-schema'], 'POST', '/api/icon/get/list', {})
  })
  it('scenario.schema.user-list', async () => {
    await observe('scenario.schema.user-list', ['response-schema'], 'POST', '/system/user/info/userList', {})
  })
  it('scenario.schema.marker-link-list', async () => {
    await observe('scenario.schema.marker-link-list', ['response-schema'], 'POST', '/api/marker_link/get/list', {})
  })
  it('scenario.schema.history-list', async () => {
    await observe('scenario.schema.history-list', ['response-schema'], 'POST', '/api/history/get/list', {})
  })
  it('scenario.schema.archive-all', async () => {
    await observe('scenario.schema.archive-all', ['response-schema', 'status-code'], 'GET', '/system/archive/all_history')
  })
  it('scenario.request.json-instead-of-form：登录改以 JSON 提交', async () => {
    const input = await capture('scenario.request.json-instead-of-form', ['request-params', 'error-code'], async () => ({
      res: await rawRequest({
        method: 'POST',
        path: '/oauth/token',
        body: { grant_type: 'password', username: '__parity__', password: '__parity__' },
        basic: true,
      }),
      method: 'POST',
      path: '/oauth/token',
      body: { grant_type: 'password', username: '<masked>', password: '<masked>' },
      authMode: 'basic',
      note: '前端实际使用 FormData；此项用于观测两端对 JSON 入参的容错差异',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })
  it('scenario.request.extra-query：多余 query 参数', async () => {
    await observe('scenario.request.extra-query', ['request-params'], 'GET', '/system/role/list?unexpected=1')
  })
})

describe('parity / 空值与边界入参 + 异常', () => {
  it('scenario.boundary.area-empty-body', async () => {
    await observe('scenario.boundary.area-empty-body', ['null-boundary', 'exception'], 'POST', '/api/area/get/list', {})
  })
  it('scenario.boundary.area-add-empty', async () => {
    await observe('scenario.boundary.area-add-empty', ['null-boundary', 'exception', 'error-code'], 'PUT', '/api/area/add', {}, '缺全部字段；若后端仍创建实体则登记清理', 'area')
  })
  it('scenario.boundary.area-missing-parentId', async () => {
    await observe('scenario.boundary.area-missing-parentId', ['null-boundary', 'exception'], 'PUT', '/api/area/add', { name: `${testPrefix}no_parent_${tag}`, code: `C:NP${tag}` }, 'Java 基线：缺少 parentId 被拒绝（area.test.ts:131）', 'area')
  })
  it('scenario.boundary.area-empty-name', async () => {
    await observe('scenario.boundary.area-empty-name', ['null-boundary', 'exception'], 'PUT', '/api/area/add', { name: '', code: `C:EN${tag}`, parentId: -1 }, 'Java 基线：缺少名称被拒绝（area.test.ts:181）', 'area')
  })
  it('scenario.boundary.area-null-code', async () => {
    await observe('scenario.boundary.area-null-code', ['null-boundary', 'exception'], 'PUT', '/api/area/add', { name: `${testPrefix}null_code_${tag}`, code: null, parentId: -1 }, 'code 显式传 null', 'area')
  })
  it('scenario.boundary.area-long-name', async () => {
    await observe('scenario.boundary.area-long-name', ['null-boundary', 'exception'], 'PUT', '/api/area/add', { name: `${testPrefix}${'x'.repeat(2048)}`, code: `C:LONG${tag}`, parentId: -1 }, '超长字符串 2048 字符', 'area')
  })
  it('scenario.boundary.area-invalid-parent-type', async () => {
    await observe('scenario.boundary.area-invalid-parent-type', ['null-boundary', 'exception'], 'PUT', '/api/area/add', { name: `${testPrefix}bad_parent_${tag}`, code: `C:BP${tag}`, parentId: 'not-a-number' }, 'parentId 类型错误', 'area')
  })
  it('scenario.boundary.area-nonexistent-id', async () => {
    await observe('scenario.boundary.area-nonexistent-id', ['exception', 'error-code'], 'POST', '/api/area/get/999999999')
  })
  it('scenario.boundary.icon-invalid-path', async () => {
    await observe('scenario.boundary.icon-invalid-path', ['exception', 'null-boundary'], 'POST', '/api/icon/get/single/abc')
  })
  it('scenario.boundary.marker-empty-id-list', async () => {
    await observe('scenario.boundary.marker-empty-id-list', ['null-boundary'], 'POST', '/api/marker/get/list_byid', { markerIdList: [] })
  })
  it('scenario.boundary.marker-negative-id', async () => {
    await observe('scenario.boundary.marker-negative-id', ['null-boundary', 'exception'], 'POST', '/api/marker/get/list_byid', { markerIdList: [-1] })
  })
  it('scenario.boundary.item-null-body', async () => {
    await observe('scenario.boundary.item-null-body', ['null-boundary'], 'POST', '/api/item/get/list_byid', null)
  })
  it('scenario.boundary.unknown-endpoint', async () => {
    await observe('scenario.boundary.unknown-endpoint', ['exception', 'status-code', 'error-code'], 'GET', '/api/__parity_not_exists__')
  })
})

describe('parity / 分页与排序', () => {
  it('scenario.paging.marker-default', async () => {
    await observe('scenario.paging.marker-default', ['pagination-sort'], 'POST', '/api/marker/get/page', {})
  })
  it('scenario.paging.marker-page0', async () => {
    await observe('scenario.paging.marker-page0', ['pagination-sort', 'null-boundary'], 'POST', '/api/marker/get/page', { current: 0, size: 10 })
  })
  it('scenario.paging.marker-size0', async () => {
    await observe('scenario.paging.marker-size0', ['pagination-sort', 'null-boundary'], 'POST', '/api/marker/get/page', { current: 1, size: 0 })
  })
  it('scenario.paging.marker-oversize', async () => {
    await observe('scenario.paging.marker-oversize', ['pagination-sort', 'null-boundary'], 'POST', '/api/marker/get/page', { current: 1, size: 10000 })
  })
  it('scenario.paging.marker-outofrange', async () => {
    await observe('scenario.paging.marker-outofrange', ['pagination-sort'], 'POST', '/api/marker/get/page', { current: 99999, size: 10 })
  })
  it('scenario.paging.punctuate-default', async () => {
    await observe('scenario.paging.punctuate-default', ['pagination-sort'], 'POST', '/api/punctuate/get/page', {})
  })
  it('scenario.paging.route-default', async () => {
    await observe('scenario.paging.route-default', ['pagination-sort'], 'POST', '/api/route/get/page', {})
  })
  it('scenario.paging.action-log-default', async () => {
    await observe('scenario.paging.action-log-default', ['pagination-sort'], 'POST', '/system/action_log/list', {})
  })
  it('scenario.paging.device-default', async () => {
    await observe('scenario.paging.device-default', ['pagination-sort'], 'POST', '/system/device/list', {})
  })
})

describe('parity / 端点可达性清单', () => {
  it('inventory.readonly-endpoints：批量只读端点探测', async () => {
    const token = await getToken()
    const source = fs.readFileSync('src/api/alova/apiDefinitions.ts', 'utf8')
    const pattern = /'([A-Za-z_0-9.]+)':\s*\['(GET|POST|PUT|DELETE)',\s*'([^']+)'/g
    const all: { name: string; method: string; path: string }[] = []
    for (const matched of source.matchAll(pattern))
      all.push({ name: matched[1], method: matched[2], path: matched[3] })

    // 只探 GET 与只读 POST；排除写语义、路径参数与二进制文档端点
    const writeWords = /add|update|create|delete|save|tweak|push|consume|register|generate|link|copy|move|join|reject|pass|restore|remove|clean|kick|rename|split|linkage/i
    const safe = all.filter(item =>
      (item.method === 'GET' || item.method === 'POST')
      && !writeWords.test(item.name)
      && !item.path.includes('{')
      && !/doc|binary|bin/i.test(item.path),
    ).slice(0, 40)

    for (const item of safe) {
      const res = await rawRequest({
        method: item.method,
        path: item.path,
        body: item.method === 'POST' ? {} : undefined,
        token,
        timeoutMs: 8_000,
      })
      // 每个端点独立成一条观测，diff 会逐一比对状态码与响应结构
      await capture(`inventory.${item.name}`, ['endpoint-inventory', 'status-code', 'response-schema'], async () => ({
        res,
        method: item.method,
        path: item.path,
        body: item.method === 'POST' ? {} : undefined,
        authMode: 'bearer-valid',
        note: `端点清单：共 ${all.length} 个端点，本轮安全探测 ${safe.length} 个（排除写语义 / 路径参数 / 二进制端点）`,
      }))
      expect(res.status).toBeGreaterThan(0)
    }
  })
})
