import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpMock, headerOf, jsonResponse } from '../_support/httpMock'

/**
 * 契约测试：共享 alova 实例的请求前置与响应处理
 *
 * 覆盖 `src/api/alova/index.ts` 中两个关键分支：
 * - `beforeRequest`：自动注入 token，但绝不覆盖调用方自带的 Authorization
 * - `responded`：401/403 登出、业务错误（HTTP 200 + error:true）转异常、正常数据透传
 *
 * `@/stores` 被替换为轻量替身：真实 store 会牵连 `@/hooks` → `@/components`
 * 整个组件树，在本进程内编译耗时极长，且契约测试并不关心 store 内部实现。
 */

const mocks = vi.hoisted(() => {
  /**
   * 刻意使用普通对象与普通函数，而非 `vi.fn`：
   * 配置中的 `restoreMocks` 会在每个用例前把 mock 实现一并还原掉。
   */
  const store = {
    auth: {} as Record<string, unknown>,
    logoutCount: 0,
    logout() {
      store.logoutCount += 1
      store.auth = {}
    },
    /** 对应真实 store：仅当剩余有效期不足时才刷新，这里恒为「有效」 */
    isTokenValid() {
      return true
    },
    async refreshToken() {
      return null
    },
    /** 对应真实 store 的 setAuth：把 OAuth 响应写入登录态 */
    setAuth(token: OauthAPI.SysToken) {
      store.auth = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenType: token.token_type,
        expiresIn: token.expires_in,
        expiresTime: Date.now() + token.expires_in * 1000,
      }
    },
  }

  return {
    store,
    reset: () => {
      store.auth = {}
      store.logoutCount = 0
    },
  }
})

vi.mock('@/stores', () => ({ useUserStore: () => mocks.store }))

const http = createHttpMock()

const makeToken = (accessToken: string, tokenType = 'bearer'): OauthAPI.SysToken => ({
  access_token: accessToken,
  token_type: tokenType,
  refresh_token: 'refresh-token',
  expires_in: 1800,
  scope: 'all',
  userRoles: [],
  userId: 1,
  jti: 'jti',
})

describe('共享 alova 实例的响应处理', () => {
  let Apis: (typeof import('@/api/alova'))['default']

  beforeEach(async () => {
    mocks.reset()
    http.requests.length = 0
    http.respond = () => jsonResponse({ data: [] })
    http.install()

    vi.resetModules()
    vi.stubEnv('VITE_API_BASE', 'https://api.example.test')

    Apis = (await import('@/api/alova')).default
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('已登录时为请求自动附加 Bearer token', async () => {
    mocks.store.setAuth(makeToken('AT-1'))

    await Apis.role.listRole({})

    expect(headerOf(http.requests[0].init, 'Authorization')).toBe('Bearer AT-1')
  })

  it('调用方自带 Authorization 时不被覆盖', async () => {
    mocks.store.setAuth(makeToken('AT-1'))

    await Apis.role.listRole({ headers: { Authorization: 'Custom custom-token' } })

    expect(headerOf(http.requests[0].init, 'Authorization')).toBe('Custom custom-token')
  })

  it('未登录时不附加 Authorization', async () => {
    await Apis.role.listRole({})

    expect(headerOf(http.requests[0].init, 'Authorization')).toBeUndefined()
  })

  it('正常业务响应直接透传数据', async () => {
    http.respond = () => jsonResponse({ error: false, data: [{ id: 1, name: '管理员' }] })

    await expect(Apis.role.listRole({})).resolves.toEqual({
      error: false,
      data: [{ id: 1, name: '管理员' }],
    })
  })

  it('业务错误以 HTTP 200 + error:true 返回时转为异常', async () => {
    http.respond = () => jsonResponse({ error: true, message: '用户不存在' })

    await expect(Apis.role.listRole({})).rejects.toThrow('用户不存在')
  })

  it.each([401, 403])('响应状态 %i 触发登出并清空登录态', async status => {
    mocks.store.setAuth(makeToken('AT-1'))
    http.respond = () => new Response('', { status, headers: { 'Content-Type': 'text/plain' } })

    await expect(Apis.role.listRole({})).rejects.toThrow()

    expect(mocks.store.logoutCount).toBe(1)
    expect(mocks.store.auth.accessToken).toBeUndefined()
    expect(mocks.store.auth.refreshToken).toBeUndefined()
  })
})
