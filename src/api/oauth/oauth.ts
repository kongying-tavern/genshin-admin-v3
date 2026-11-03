import { createAlova } from 'alova'
import fetchAdapter from 'alova/fetch'
import VueHook from 'alova/vue'
import { useUserStore } from '@/stores'

/**
 * OAuth 专用的 alova 实例。
 *
 * 刻意与 `@/api/alova` 的共享实例分离：登录/刷新端点不能套用
 * `createClientTokenAuthentication` 的请求前自动刷新与 token 注入，
 * 否则登录态即将过期时会自触发刷新、或把过期 token 附带到登录请求上，
 * 造成行为偏差甚至递归。此处仅携带 Basic Auth，保持与原 axios 封装一致。
 */
const oauthInstance = createAlova({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 300 * 1000,
  statesHook: VueHook,
  cacheFor: null,
  requestAdapter: fetchAdapter(),

  responded: async response => {
    const { status } = response

    const errorMessage = (error: {
      message?: string
      error_description?: string
      errorData?: unknown
      statusText: string
    }): string => {
      const { message, error_description, errorData, statusText } = error
      return (
        message
        ?? error_description
        ?? (typeof errorData === 'string' ? errorData : undefined)
        ?? statusText
      )
    }

    if (status < 200 || status >= 400) {
      // 401/403 视为会话失效，触发登出（若已登录）
      if (status === 401 || status === 403) useUserStore().logout()

      throw new Error(errorMessage({ statusText: response.statusText }))
    }

    const data = (await response.json()) as {
      error?: boolean
      message?: string
      error_description?: string
      errorData?: unknown
    }

    if (data.error)
      throw new Error(
        errorMessage({
          message: data.message,
          error_description: data.error_description,
          errorData: data.errorData,
          statusText: response.statusText,
        }),
      )

    return data as unknown
  },
})

/** Basic 认证头（OAuth 客户端凭据） */
const basicAuth = `Basic ${btoa(`${import.meta.env.VITE_API_AUTH_USERNAME}:${import.meta.env.VITE_API_AUTH_PASSWORD}`)}`

/** 登录 - 密码模式 */
export async function token(body: OauthAPI.SysTokenVO) {
  const form = new FormData()
  for (const key in body) {
    const value = body[key as keyof typeof body]
    form.append(key, value)
  }
  return await oauthInstance.Post<OauthAPI.SysToken>('/oauth/token', form, {
    headers: {
      Authorization: basicAuth,
    },
  })
}

export async function refresh(header: OauthAPI.SysRefreshVO) {
  const params = new URLSearchParams()
  for (const key in header) params.append(key, header[key as keyof OauthAPI.SysRefreshVO])
  return await oauthInstance.Post<OauthAPI.SysToken>(
    `/oauth/token?${params.toString()}`,
    undefined,
    {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: basicAuth,
      },
    },
  )
}
