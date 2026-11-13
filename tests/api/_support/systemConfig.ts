/**
 * 系统订阅配置的接口测试辅助
 *
 * 订阅源地址来自 `VITE_CONFIG_ARCHIVE`（见 `.env`），默认指向二进制归档。
 * 集成用例真实依赖 dev 资源服务器，网络不可达时应当整体跳过而不是报错，
 * 因此这里提供与 `backend.ts` 相同风格的探活逻辑。
 */

/** 订阅配置归档地址 */
export const systemConfigArchiveUrl = import.meta.env.VITE_CONFIG_ARCHIVE

/** 是否为 bz2 二进制归档 */
export const isBz2Archive = Boolean(systemConfigArchiveUrl?.endsWith('.bz2'))

/** 归档对应的明文 JSON 地址（二进制版本即去掉 `.bz2` 后缀） */
export const systemConfigJsonUrl = isBz2Archive
  ? systemConfigArchiveUrl.slice(0, -'.bz2'.length)
  : systemConfigArchiveUrl

/**
 * 归档是否可访问
 *
 * 只关心「资源服务器是否能返回归档」，任何网络层错误（DNS / 连接失败 / 超时）
 * 都视为不可达，交由用例整体跳过。
 */
export const probeSystemConfigArchive = async () => {
  if (!systemConfigArchiveUrl) return false
  try {
    const res = await fetch(systemConfigArchiveUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}
