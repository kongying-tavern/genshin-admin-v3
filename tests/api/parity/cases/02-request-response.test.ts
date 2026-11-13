import { describe, expect, it } from 'vitest'
import { buildLoginForm, rawRequest } from '../_support/client'
import { testAccount } from '../_support/env'
import { capture } from '../_support/observer'
import { getToken } from '../_support/session'

/**
 * ② 请求参数构造 / 响应体字段与类型 / HTTP 状态码 / 业务错误码 / 响应头
 *
 * 覆盖 FormData、query、pathParams、JSON body 四类入参构造差异；
 * 每个 it 都通过 capture 采集一次真实后端响应，快照自带 env / envFile / baseUrl 溯源。
 * 用例内只断言「确实取到了真实 HTTP 响应」（status>0 / 必要字段存在），
 * 跨环境差异统一交给离线 diff 以 Java 为基线裁决，避免单端红灯中断全量采集。
 */

/** 从只读列表接口取一个真实 id；取不到时退化为保守占位值，保证两端 pathParams 完全一致 */
const pickFirstId = async (token: string, path: string, body: unknown): Promise<number> => {
  const res = await rawRequest({ method: 'POST', path, body, token })
  const data = res.body?.data
  const list = Array.isArray(data) ? data : (Array.isArray(data?.record) ? data.record : [])
  const id = list[0]?.id
  return typeof id === 'number' ? id : 1
}

describe('parity / 请求参数·响应结构·状态码·响应头', () => {
  // ---- 请求参数构造：FormData / JSON / query / pathParams ----
  it('request.formdata.oauth-extra-field', async () => {
    const form = buildLoginForm(testAccount.username, testAccount.password)
    form.append('scope', 'all')
    const input = await capture('request.formdata.oauth-extra-field', ['request-params', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/oauth/token', body: form, basic: true }),
      method: 'POST',
      path: '/oauth/token',
      body: 'FormData(grant_type,username,password,scope)',
      authMode: 'basic',
      note: 'FormData 追加未知字段 scope，观察前端 OAuth 表单构造的容错差异；凭据不落盘',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('request.json.oauth-json-body', async () => {
    const input = await capture('request.json.oauth-json-body', ['request-params', 'status-code', 'error-code'], async () => ({
      res: await rawRequest({
        method: 'POST',
        path: '/oauth/token',
        body: { grant_type: 'password', username: testAccount.username, password: testAccount.password },
        basic: true,
      }),
      method: 'POST',
      path: '/oauth/token',
      body: 'JSON(grant_type,username,password)',
      authMode: 'basic',
      note: '以 JSON 而非 FormData 提交 OAuth 表单，观察 Content-Type 解析与业务错误码差异；凭据不落盘',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('request.query.oauth-params-in-query', async () => {
    const q = new URLSearchParams({
      grant_type: 'password',
      username: testAccount.username,
      password: testAccount.password,
    })
    const input = await capture('request.query.oauth-params-in-query', ['request-params', 'status-code'], async () => ({
      res: await rawRequest({ method: 'POST', path: `/oauth/token?${q.toString()}`, basic: true }),
      method: 'POST',
      path: '/oauth/token?grant_type=password&username=<masked>&password=<masked>',
      body: undefined,
      authMode: 'basic',
      note: '把 OAuth 参数放到 query string；快照 path 已脱敏，凭据不落盘',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('request.query.role-list-extra-params', async () => {
    const token = await getToken()
    const input = await capture('request.query.role-list-extra-params', ['request-params', 'status-code', 'headers'], async () => ({
      res: await rawRequest({ method: 'GET', path: '/system/role/list?foo=bar&_t=1', token }),
      method: 'GET',
      path: '/system/role/list?foo=bar&_t=1',
      authMode: 'bearer-valid',
      note: 'GET 携带无关 query 参数，观察是否被忽略及响应头是否变化',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('request.json.area-list-typed', async () => {
    const token = await getToken()
    const body = { parentId: -1, isTraverse: true }
    const input = await capture('request.json.area-list-typed', ['request-params', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: 'JSON body 使用正确数值 / 布尔类型',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('request.json.area-list-stringly', async () => {
    const token = await getToken()
    const body = { parentId: '-1', isTraverse: 'true' }
    const input = await capture('request.json.area-list-stringly', ['request-params', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: '同名字段被字符串化，观察后端类型强制转换与响应结构差异',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('request.pathparam.area-get-real-id', async () => {
    const token = await getToken()
    const areaId = await pickFirstId(token, '/api/area/get/list', { parentId: -1, isTraverse: true })
    const input = await capture('request.pathparam.area-get-real-id', ['request-params', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: `/api/area/get/${areaId}`, token }),
      method: 'POST',
      path: '/api/area/get/{areaId}',
      authMode: 'bearer-valid',
      note: 'pathParams 取只读列表中的真实地区 id（取不到退化为 1）；快照 path 用模板保证两端一致',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('request.pathparam.icon-single-real-id', async () => {
    const token = await getToken()
    const iconId = await pickFirstId(token, '/api/icon/get/list', { current: 1, size: 10 })
    const input = await capture('request.pathparam.icon-single-real-id', ['request-params', 'response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: `/api/icon/get/single/${iconId}`, token }),
      method: 'POST',
      path: '/api/icon/get/single/{iconId}',
      authMode: 'bearer-valid',
      note: 'pathParams 取只读列表中的真实图标 id（取不到退化为 1）；快照 path 用模板保证两端一致',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ---- 响应体字段与类型 ----
  it('response.schema.role-list', async () => {
    const token = await getToken()
    const input = await capture('response.schema.role-list', ['response-schema', 'headers'], async () => ({
      res: await rawRequest({ method: 'GET', path: '/system/role/list', token }),
      method: 'GET',
      path: '/system/role/list',
      authMode: 'bearer-valid',
      note: '采集角色列表顶层键、字段类型与响应头',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('response.schema.area-list', async () => {
    const token = await getToken()
    const body = { parentId: -1, isTraverse: true }
    const input = await capture('response.schema.area-list', ['response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/list', body, token }),
      method: 'POST',
      path: '/api/area/get/list',
      body,
      authMode: 'bearer-valid',
      note: '采集地区列表顶层键与 data 数组元素结构',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('response.schema.icon-list', async () => {
    const token = await getToken()
    const body = { current: 1, size: 10 }
    const input = await capture('response.schema.icon-list', ['response-schema'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/icon/get/list', body, token }),
      method: 'POST',
      path: '/api/icon/get/list',
      body,
      authMode: 'bearer-valid',
      note: '分页响应体（data.record / total）顶层键与字段类型',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ---- HTTP 状态码 ----
  it('status.code.wrong-method-on-get', async () => {
    const token = await getToken()
    const input = await capture('status.code.wrong-method-on-get', ['status-code', 'exception'], async () => ({
      res: await rawRequest({ method: 'PUT', path: '/system/role/list', body: {}, token }),
      method: 'PUT',
      path: '/system/role/list',
      authMode: 'bearer-valid',
      note: '对只接受 GET 的端点使用 PUT，观察 405/400 等状态码与错误体',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('status.code.unknown-path', async () => {
    const token = await getToken()
    const input = await capture('status.code.unknown-path', ['status-code', 'exception'], async () => ({
      res: await rawRequest({ method: 'GET', path: '/api/parity/no-such-endpoint', token }),
      method: 'GET',
      path: '/api/parity/no-such-endpoint',
      authMode: 'bearer-valid',
      note: '访问不存在的路径，观察 404 及错误体结构',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ---- 业务错误码（error / errorStatus / message）----
  it('error.code.area-nonexistent', async () => {
    const token = await getToken()
    const input = await capture('error.code.area-nonexistent', ['error-code', 'status-code'], async () => ({
      res: await rawRequest({ method: 'POST', path: '/api/area/get/999999999', token }),
      method: 'POST',
      path: '/api/area/get/{areaId}',
      authMode: 'bearer-valid',
      note: '不存在的地区 id，采集 error / errorStatus / message 业务错误码',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('error.code.no-token', async () => {
    const input = await capture('error.code.no-token', ['error-code', 'status-code', 'headers'], async () => ({
      res: await rawRequest({ method: 'GET', path: '/system/role/list' }),
      method: 'GET',
      path: '/system/role/list',
      authMode: 'none',
      note: '未携带凭据，采集 401/403 状态码与业务错误码',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  // ---- 响应头（含 cache-control 与安全头）----
  it('headers.cache-and-security', async () => {
    const token = await getToken()
    const input = await capture('headers.cache-and-security', ['headers'], async () => ({
      res: await rawRequest({ method: 'GET', path: '/system/role/list', token }),
      method: 'GET',
      path: '/system/role/list',
      authMode: 'bearer-valid',
      note: '采集全部响应头（content-type / cache-control / 安全头），由离线 diff 逐头比对',
    }))
    expect(input.res.status).toBeGreaterThan(0)
    expect(typeof input.res.headers).toBe('object')
  })
})
