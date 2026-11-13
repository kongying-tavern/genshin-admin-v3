import { buildLoginForm, rawRequest } from './client'
import { testAccount } from './env'

type Session = {
  accessToken: string
  refreshToken: string
  userId: number
  expiresIn: number
  loginObservation: Awaited<ReturnType<typeof rawRequest>>
}

let session: Session | null = null

/**
 * 在当前环境登录。每个环境只登录一次，token 绝不跨环境复用。
 * 登录失败直接抛错，不允许静默跳过。
 */
export async function login(): Promise<Session> {
  if (session) return session

  const res = await rawRequest({
    method: 'POST',
    path: '/oauth/token',
    body: buildLoginForm(testAccount.username, testAccount.password),
    basic: true,
  })

  if (!res.ok || res.networkError)
    throw new Error(`[parity] 登录请求失败：${res.networkError ?? `status=${res.status}`}`)

  const token = res.body?.access_token
  if (res.status !== 200 || typeof token !== 'string' || !token)
    throw new Error(`[parity] 登录未取得 access_token：status=${res.status} body=${res.bodyText.slice(0, 200)}`)

  session = {
    accessToken: token,
    refreshToken: String(res.body.refresh_token ?? ''),
    userId: Number(res.body.userId ?? 0),
    expiresIn: Number(res.body.expires_in ?? 0),
    loginObservation: res,
  }
  return session
}

export const getToken = async () => (await login()).accessToken

/** 清掉进程内会话（仅用于测试内部会话失效场景，不影响真实后端） */
export const resetSession = () => {
  session = null
}
