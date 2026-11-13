import { describe, expect, it } from 'vitest'
import { buildLoginForm, rawRequest } from '../_support/client'
import { testAccount } from '../_support/env'
import { deriveFrontendView, type FrontendLayer } from '../_support/frontendView'
import { capture } from '../_support/observer'
import { getToken } from '../_support/session'

/**
 * ⑫ 前端调用方视角：alova 封装层可见行为
 *
 * 09/01 等用例用原生 fetch 旁路采集「服务端原生响应」，能完整观测状态码 /
 * 响应头 / 错误码，但那不是前端实际拿到的东西。本组对**同一批真实响应**
 * 应用 src/api/alova/index.ts:52-80 与 src/api/oauth/oauth.ts:21-64 的
 * responded 规则，推导出前端调用方真正可见的结果（抛什么错、登出与否、
 * 拿到解析数据还是原始 Response、可见顶层字段），并纳入双环境比对。
 */

const observeFrontend = async (
  caseId: string,
  tags: string[],
  layer: FrontendLayer,
  options: { method: string; path: string; body?: unknown; token?: string | null; basic?: boolean },
  note?: string,
) => {
  const input = await capture(caseId, tags, async () => {
    const res = await rawRequest(options)
    return {
      res,
      method: options.method,
      path: options.path,
      body: options.body instanceof FormData ? 'FormData(grant_type,username,password)' : options.body,
      authMode: options.basic ? 'basic' : options.token ? 'bearer-valid' : 'none',
      frontend: deriveFrontendView(res, layer),
      note,
    }
  })
  expect(input.res.status).toBeGreaterThan(0)
  return input
}

describe('parity / 前端 alova 封装层可见行为', () => {
  it('frontend.role-list.valid-token', async () => {
    await observeFrontend('frontend.role-list.valid-token', ['frontend', 'response-schema'], 'shared-alova', {
      method: 'GET', path: '/system/role/list', token: await getToken(),
    })
  })

  it('frontend.role-list.no-token', async () => {
    await observeFrontend('frontend.role-list.no-token', ['frontend', 'status-code', 'error-code'], 'shared-alova', {
      method: 'GET', path: '/system/role/list',
    }, '共享实例把 401/403 转成 Error(statusText) 并触发 logout')
  })

  it('frontend.role-list.invalid-token', async () => {
    const res = await rawRequest({
      method: 'GET', path: '/system/role/list',
      headers: { Authorization: 'Bearer invalid-parity-token' },
    })
    await capture('frontend.role-list.invalid-token', ['frontend', 'error-code'], async () => ({
      res,
      method: 'GET', path: '/system/role/list', authMode: 'bearer-invalid',
      frontend: deriveFrontendView(res, 'shared-alova'),
      note: 'Java 返回纯文本错误体；Rust 返回 JSON 错误对象，前端封装层可见行为不同',
    }))
    expect(res.status).toBeGreaterThan(0)
  })

  it('frontend.login.oauth', async () => {
    await observeFrontend('frontend.login.oauth', ['frontend', 'session'], 'oauth-alova', {
      method: 'POST', path: '/oauth/token',
      body: buildLoginForm(testAccount.username, testAccount.password), basic: true,
    }, 'OAuth 实例不检查 content-type，直接 response.json()')
  })

  it('frontend.login.no-basic', async () => {
    await observeFrontend('frontend.login.no-basic', ['frontend', 'auth', 'error-code'], 'oauth-alova', {
      method: 'POST', path: '/oauth/token',
      body: buildLoginForm(testAccount.username, testAccount.password),
    }, 'Java 401 / Rust 200 且发放 token：OAuth 客户端鉴权差异')
  })

  it('frontend.login.bad-password', async () => {
    await observeFrontend('frontend.login.bad-password', ['frontend', 'error-code'], 'oauth-alova', {
      method: 'POST', path: '/oauth/token',
      body: buildLoginForm(testAccount.username, `${testAccount.password}__wrong`), basic: true,
    })
  })

  it('frontend.area-list.shared', async () => {
    await observeFrontend('frontend.area-list.shared', ['frontend', 'response-schema'], 'shared-alova', {
      method: 'POST', path: '/api/area/get/list', token: await getToken(),
      body: { parentId: -1, isTraverse: true },
    }, 'Java content-type=application/json；Rust 同为 application/json，但 users 字典与字段集合不同')
  })

  it('frontend.unknown-endpoint.shared', async () => {
    await observeFrontend('frontend.unknown-endpoint.shared', ['frontend', 'exception'], 'shared-alova', {
      method: 'GET', path: '/api/__parity_not_exists__', token: await getToken(),
    })
  })

  it('frontend.business-error.shared', async () => {
    await observeFrontend('frontend.business-error.shared', ['frontend', 'error-code'], 'shared-alova', {
      method: 'POST', path: '/api/area/get/999999999', token: await getToken(),
    }, 'HTTP 200 + error:true 的业务错误会被共享实例转成 Error(message)')
  })
})
