import { useUserStore } from '@/stores'
import { account } from './env'

/**
 * 以指定账号登录，并把 token 写入用户 store。
 * 登录后，共享 alova 实例的 `beforeRequest` 会自动为后续请求附加 Authorization 头。
 */
export const loginAs = async (username: string, password: string) => {
  const store = useUserStore()
  return await store.login({ grant_type: 'password', username, password })
}

/** 使用 `.env.test.local` 中配置的测试主账号登录 */
export const loginAsTestAccount = () => loginAs(account.username, account.password)
