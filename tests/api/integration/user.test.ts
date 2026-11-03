import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import Apis from '@/api/alova'
import { loginAs, loginAsTestAccount } from '../_support/auth'
import { probeIntegration } from '../_support/backend'
import { cleanupCreatedUsers } from '../_support/cleanup'
import { integrationConfigured } from '../_support/env'
import { createTestUser } from '../_support/factories'
import { setupApiEnv } from '../_support/pinia'

/**
 * 集成测试：用户体系
 *
 * 覆盖注册 / 查询 / 更新 / 改密 / 删除 / 踢出这条完整链路。
 * 所有临时用户统一使用 `__apitest_` 前缀，并在 afterAll 中回收，
 * 避免污染 dev 后端。
 */

const enabled = await probeIntegration(integrationConfigured)

describe.skipIf(!enabled)('集成：用户体系', () => {
  beforeEach(() => {
    setupApiEnv()
  })

  afterAll(async () => {
    await cleanupCreatedUsers()
  })

  describe('注册与查询', () => {
    it('管理员注册的用户可立即查询到', async () => {
      await loginAsTestAccount()
      const user = await createTestUser()

      const { data } = await Apis.user.getUserInfo({ pathParams: { userId: user.userId } })

      expect(data?.username).toBe(user.username)
    })

    it('重复用户名注册被拒绝', async () => {
      await loginAsTestAccount()
      const user = await createTestUser()

      await expect(
        Apis.user.registerUser({
          data: { username: user.username, password: user.password },
        }),
      ).rejects.toThrow('用户已存在，请检查是否输入正确')
    })

    it('查询不存在的用户被拒绝', async () => {
      await loginAsTestAccount()

      await expect(Apis.user.getUserInfo({ pathParams: { userId: 999999 } })).rejects.toThrow(
        '用户不存在',
      )
    })
  })

  describe('信息与密码更新', () => {
    it('管理员可更新指定用户的信息', async () => {
      await loginAsTestAccount()
      const user = await createTestUser()

      const { data } = await Apis.user.updateUser({
        data: { userId: user.userId, nickname: 'apitest-nickname' },
      })
      expect(data).toBe(true)

      const { data: info } = await Apis.user.getUserInfo({ pathParams: { userId: user.userId } })
      expect(info?.nickname).toBe('apitest-nickname')
    })

    it('普通用户修改他人密码被拒绝', async () => {
      const admin = await loginAsTestAccount()
      const user = await createTestUser()
      await loginAs(user.username, user.password)

      await expect(
        Apis.user.updateUserPassword({
          data: { userId: admin.userId, password: 'apitest-hacked' },
        }),
      ).rejects.toThrow('无法更改其他用户的密码')
    })

    it('管理员重置密码后，用户可用新密码登录', async () => {
      await loginAsTestAccount()
      const user = await createTestUser()
      const newPassword = 'apitest-newpwd888'

      const { data } = await Apis.user.updateUserPasswordByAdmin({
        data: { userId: user.userId, password: newPassword },
      })
      expect(data).toBe(true)

      const token = await loginAs(user.username, newPassword)
      expect(token.access_token).toBeTruthy()
    })
  })

  describe('删除与踢出', () => {
    it('删除用户后无法再查询到', async () => {
      await loginAsTestAccount()
      const user = await createTestUser()

      const { data } = await Apis.user.deleteUser({ pathParams: { workId: user.userId } })
      expect(data).toBe(true)

      await expect(Apis.user.getUserInfo({ pathParams: { userId: user.userId } })).rejects.toThrow(
        '用户不存在',
      )
    })

    it('踢出用户仅失效其会话，不删除账号', async () => {
      await loginAsTestAccount()
      const user = await createTestUser()

      const { data } = await Apis.user.kickOutUser({ pathParams: { workId: user.userId } })
      expect(data).toBe(true)

      const { data: info } = await Apis.user.getUserInfo({ pathParams: { userId: user.userId } })
      expect(info?.username).toBe(user.username)
    })
  })
})
