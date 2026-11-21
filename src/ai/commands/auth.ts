import type { BridgeCommand } from '@/ai/types'
import { MapAiError, fail } from '@/ai/errors'
import { objectSchema } from '@/ai/validate'
import { getAuthStatus } from '@/ai/appSnapshot'
import { useUserStore } from '@/stores/user'

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

const waitUntilLogin = async (timeoutMs: number) => {
  const userStore = useUserStore()
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (userStore.isLogin) return true
    if (!userStore.auth.accessToken) return false
    await sleep(100)
  }
  if (userStore.isLogin) return true
  throw new MapAiError('E_TIMEOUT', '登录超时，未获取到用户信息', {
    details: { timeoutMs },
    hint: '请检查后端账号密码与网络；开发环境可在 .env.development.local 配置 VITE_AUTO_COMPLETE_*',
  })
}

/** auth.* 命令 */
export const createAuthCommands = (): BridgeCommand[] => [
  {
    id: 'auth.status',
    title: '登录态',
    description: '返回登录状态、用户信息、角色权限与 token 过期时间（不返回 token 原文）',
    access: 'read',
    params: objectSchema({}),
    returns: 'AuthStatus',
    examples: [{ title: '查看当前登录用户' }],
    handler: () => getAuthStatus(),
  },
  {
    id: 'auth.login',
    title: '登录',
    description: '使用账号密码登录并等待用户信息加载完成；开发环境可省略参数使用自动填充账号',
    access: 'write',
    tags: ['sensitive'],
    params: objectSchema({
      username: {
        type: 'string',
        description: '用户名，开发环境缺省取 VITE_AUTO_COMPLETE_USERNAME',
      },
      password: { type: 'string', description: '密码，开发环境缺省取 VITE_AUTO_COMPLETE_PASSWORD' },
      timeoutMs: {
        type: 'number',
        default: 15000,
        minimum: 1000,
        maximum: 120000,
        description: '等待用户信息加载的超时时间',
      },
    }),
    returns: '{ isLogin, alreadyLoggedIn, user }',
    examples: [{ title: '使用开发环境自动填充账号登录' }],
    handler: async params => {
      const userStore = useUserStore()
      if (userStore.isLogin) {
        return {
          isLogin: true,
          alreadyLoggedIn: true,
          user: getAuthStatus().user,
        }
      }

      const username =
        (params.username as string | undefined)
        ?? (import.meta.env.DEV ? import.meta.env.VITE_AUTO_COMPLETE_USERNAME : '')
      const password =
        (params.password as string | undefined)
        ?? (import.meta.env.DEV ? import.meta.env.VITE_AUTO_COMPLETE_PASSWORD : '')

      if (!username?.trim() || !password) {
        fail('E_INVALID_PARAMS', '登录需要 username 与 password', {
          hint: '开发环境可在 .env.development.local 配置自动填充账号',
        })
      }

      await userStore.login({
        grant_type: 'password',
        username,
        password,
      })

      const loggedIn = await waitUntilLogin(Number(params.timeoutMs ?? 15000))
      if (!loggedIn) {
        throw new MapAiError('E_DOMAIN', '登录失败：会话未建立或用户信息获取失败', {
          hint: '请确认账号密码与后端服务状态',
        })
      }

      return {
        isLogin: true,
        alreadyLoggedIn: false,
        user: getAuthStatus().user,
      }
    },
  },
  {
    id: 'auth.logout',
    title: '登出',
    description: '清除当前登录态，并关闭 WebSocket',
    access: 'write',
    params: objectSchema({}),
    returns: '{ isLogin: false }',
    examples: [{ title: '退出登录' }],
    handler: async () => {
      const userStore = useUserStore()
      await userStore.logout()
      return { isLogin: false }
    },
  },
]
