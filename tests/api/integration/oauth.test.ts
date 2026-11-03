import { beforeEach, describe, expect, it } from 'vitest'
import Oauth from '@/api/oauth'
import { useUserStore } from '@/stores'
import { loginAs } from '../_support/auth'
import { probeIntegration } from '../_support/backend'
import { account, integrationConfigured } from '../_support/env'
import { setupApiEnv } from '../_support/pinia'

/**
 * 集成测试：OAuth 令牌获取与刷新
 *
 * 直接请求真实 dev 后端，验证「账号密码换 token」这条链路的端到端行为。
 * 凭据未配置或后端不可达时整体跳过，保证 `pnpm test` 不因环境缺失而红灯。
 */

const enabled = await probeIntegration(integrationConfigured)

describe.skipIf(!enabled)('集成：OAuth 令牌获取与刷新', () => {
  beforeEach(() => {
    setupApiEnv()
  })

  it('账号密码正确时换取 token，并写入本地登录态', async () => {
    const token = await loginAs(account.username, account.password)

    expect(token.access_token).toBeTruthy()
    expect(token.refresh_token).toBeTruthy()
    expect(token.userId).toBeGreaterThan(0)

    const { auth } = useUserStore()
    expect(auth.accessToken).toBe(token.access_token)
    expect(auth.expiresTime ?? 0).toBeGreaterThan(Date.now())
  })

  it('密码错误时登录失败，且不写入登录态', async () => {
    await expect(loginAs(account.username, `${account.password}__wrong`)).rejects.toThrow(
      'Bad Request',
    )

    expect(useUserStore().auth.accessToken).toBeUndefined()
  })

  it('refresh_token 可换取新的 access token', async () => {
    const token = await loginAs(account.username, account.password)

    const refreshed = await Oauth.oauth.refresh({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    })

    expect(refreshed.access_token).toBeTruthy()
    expect(refreshed.userId).toBe(token.userId)
  })
})
