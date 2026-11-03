import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import Apis from '@/api/alova'
import { useUserStore } from '@/stores'
import { loginAs, loginAsTestAccount } from '../_support/auth'
import { probeIntegration } from '../_support/backend'
import { cleanupCreatedUsers } from '../_support/cleanup'
import { integrationConfigured } from '../_support/env'
import { createTestUser, TEST_USER_PASSWORD, TEST_USER_PREFIX } from '../_support/factories'
import { setupApiEnv } from '../_support/pinia'

/**
 * 集成测试：鉴权拦截与权限阶梯
 *
 * 验证共享 alova 实例在真实后端下的鉴权行为：
 * 未登录被拒（403）、无效 token 被拒并清空登录态（401）、
 * 以及普通用户与管理员在同一受保护接口上的权限差异。
 */

const enabled = await probeIntegration(integrationConfigured)

describe.skipIf(!enabled)('集成：鉴权与权限阶梯', () => {
  beforeEach(() => {
    setupApiEnv()
  })

  afterAll(async () => {
    await cleanupCreatedUsers()
  })

  it('未登录访问受保护接口被拒绝（403）', async () => {
    await expect(Apis.role.listRole({})).rejects.toThrow('Forbidden')
  })

  it('携带无效 token 被拒绝（401），并清空本地登录态', async () => {
    const store = useUserStore()
    store.setAuth({
      access_token: 'invalid-access-token',
      token_type: 'bearer',
      refresh_token: 'invalid-refresh-token',
      expires_in: 1800,
      scope: 'all',
      userRoles: [],
      userId: 1,
      jti: 'invalid',
    })

    await expect(Apis.role.listRole({})).rejects.toThrow('Unauthorized')

    expect(store.auth.accessToken).toBeUndefined()
    expect(store.auth.refreshToken).toBeUndefined()
  })

  it('普通用户（MAP_USER）无权注册新用户（403）', async () => {
    // 注册新用户属于管理员接口：先以管理员创建普通用户，再切换为该用户身份
    await loginAsTestAccount()
    const user = await createTestUser()
    await loginAs(user.username, user.password)

    await expect(
      Apis.user.registerUser({
        data: { username: `${TEST_USER_PREFIX}denied`, password: TEST_USER_PASSWORD },
      }),
    ).rejects.toThrow('Forbidden')
  })

  it('管理员可注册新用户', async () => {
    await loginAsTestAccount()

    const user = await createTestUser()

    expect(user.userId).toBeGreaterThan(0)
  })
})
