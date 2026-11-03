import { apiBase } from './env'

/**
 * 后端探活
 *
 * 集成用例真实依赖 dev 后端，网络不可达时应当整体跳过而不是报错。
 * 这里访问一个受保护接口：未带凭据必然得到 403，
 * 因此「能拿到 HTTP 响应」即说明服务在运行，只有网络层错误（DNS / 连接失败 / 超时）才视为不可达。
 */
export const isBackendReachable = async (): Promise<boolean> => {
  if (!apiBase) return false
  try {
    await fetch(`${apiBase}/system/role/list`, {
      signal: AbortSignal.timeout(5000),
    })
    return true
  } catch {
    return false
  }
}

/** 集成用例是否可以真实运行：配置齐备且后端可达 */
export const probeIntegration = async (configured: boolean) =>
  configured && (await isBackendReachable())
