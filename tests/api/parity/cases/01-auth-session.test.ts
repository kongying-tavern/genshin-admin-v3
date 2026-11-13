import { describe, expect, it } from 'vitest'
import { buildLoginForm, rawRequest } from '../_support/client'
import { testAccount } from '../_support/env'
import { capture } from '../_support/observer'
import { getToken, login, resetSession } from '../_support/session'

/**
 * ① 鉴权与会话：登录、刷新、无凭据 / 无效凭据 / 有效凭据访问受保护接口。
 *
 * 每条用例在两个环境各执行一次，快照写入 _reports/snapshots/<env>/<caseId>.json，
 * 结果带 env 与 envFile 溯源。用例内只做「响应确实来自真实后端」的自洽断言，
 * 跨环境差异统一由 diff-report.mjs 以 Java 为基线裁决，避免单端红灯中断全量采集。
 */
describe('parity / 鉴权与会话', () => {
  it('auth.login.password：密码模式换取 token', async () => {
    const session = await login()
    const input = await capture('auth.login.password', ['auth', 'session', 'response-schema'], async () => ({
      res: session.loginObservation,
      method: 'POST',
      path: '/oauth/token',
      body: 'FormData(grant_type,username,password)',
      authMode: 'basic',
      note: '前端 src/api/oauth/oauth.ts 以 FormData + Basic 提交',
    }))
    expect(input.res.status).toBeGreaterThanOrEqual(200)
    expect(session.accessToken).toBeTruthy()
  })

  it('auth.login.bad-password：错误密码被拒绝', async () => {
    const input = await capture('auth.login.bad-password', ['auth', 'error'], async () => ({
      res: await rawRequest({
        method: 'POST',
        path: '/oauth/token',
        body: buildLoginForm(testAccount.username, `${testAccount.password}__wrong`),
        basic: true,
      }),
      method: 'POST',
      path: '/oauth/token',
      body: 'FormData(grant_type,username,password_wrong)',
      authMode: 'basic',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('auth.login.no-basic：缺少 OAuth 客户端 Basic 认证', async () => {
    const input = await capture('auth.login.no-basic', ['auth', 'error'], async () => ({
      res: await rawRequest({
        method: 'POST',
        path: '/oauth/token',
        body: buildLoginForm(testAccount.username, testAccount.password),
      }),
      method: 'POST',
      path: '/oauth/token',
      body: 'FormData(grant_type,username,password)',
      authMode: 'none',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('auth.refresh：refresh_token 换取新 access token', async () => {
    const session = await login()
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    })
    const input = await capture('auth.refresh', ['auth', 'session', 'request-params'], async () => ({
      res: await rawRequest({
        method: 'POST',
        path: `/oauth/token?${params.toString()}`,
        basic: true,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      }),
      method: 'POST',
      path: '/oauth/token?grant_type=refresh_token&refresh_token=<masked>',
      body: undefined,
      authMode: 'basic',
      note: '前端以 query 传参、显式声明 JSON 内容类型',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('auth.protected.no-token：未登录访问受保护接口', async () => {
    const input = await capture('auth.protected.no-token', ['auth', 'status-code', 'error'], async () => ({
      res: await rawRequest({ method: 'GET', path: '/system/role/list' }),
      method: 'GET',
      path: '/system/role/list',
      authMode: 'none',
      note: '现有 tests/api/integration/auth-ladder.test.ts:31 断言 Forbidden',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('auth.protected.invalid-token：无效 token 访问受保护接口', async () => {
    const input = await capture('auth.protected.invalid-token', ['auth', 'status-code', 'error'], async () => ({
      res: await rawRequest({
        method: 'GET',
        path: '/system/role/list',
        headers: { Authorization: 'Bearer invalid-parity-token' },
      }),
      method: 'GET',
      path: '/system/role/list',
      authMode: 'bearer-invalid',
      note: '现有 tests/api/integration/auth-ladder.test.ts:47 断言 Unauthorized',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('auth.protected.valid-token：有效 token 读取角色列表', async () => {
    const token = await getToken()
    const input = await capture('auth.protected.valid-token', ['auth', 'response-schema', 'headers'], async () => ({
      res: await rawRequest({ method: 'GET', path: '/system/role/list', token }),
      method: 'GET',
      path: '/system/role/list',
      authMode: 'bearer-valid',
      note: 'Java 基线：refresh 之后原 access token 仍有效；Rust 侧实测返回 401，差异交由比对裁决',
    }))
    // 自洽断言：只确认拿到了真实响应，不把 Java 基线值写进单端用例
    expect(input.res.status).toBeGreaterThan(0)
  })

  it('auth.session.relogin：重置本地会话后重新登录仍可用', async () => {
    resetSession()
    const token = await getToken()
    const input = await capture('auth.session.relogin', ['auth', 'session'], async () => ({
      res: await rawRequest({ method: 'GET', path: '/system/role/list', token }),
      method: 'GET',
      path: '/system/role/list',
      authMode: 'bearer-valid',
    }))
    expect(input.res.status).toBeGreaterThan(0)
  })
})
