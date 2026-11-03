/**
 * 接口测试运行环境
 *
 * vitest 以 `test` 模式启动，会自动加载 `.env.test`；
 * 若本地存在 `.env.test.local`（已被 .gitignore 忽略）则覆盖前者。
 * 因此后端地址与凭据一律从 `import.meta.env` 读取，不在代码中硬编码。
 */

/** 后端接口绝对地址（注意：测试环境没有 dev server 反代理，必须是绝对地址） */
export const apiBase = import.meta.env.VITE_API_BASE

/** OAuth 客户端凭据，用于登录 / 刷新接口的 Basic 认证 */
export const clientAuth = {
  username: import.meta.env.VITE_API_AUTH_USERNAME,
  password: import.meta.env.VITE_API_AUTH_PASSWORD,
}

/** 集成测试使用的主账号（需具备 ADMIN 权限） */
export const account = {
  username: import.meta.env.VITE_TEST_USERNAME,
  password: import.meta.env.VITE_TEST_PASSWORD,
}

/**
 * 集成本身所需配置是否齐备。
 * 任一必需项缺失时整体跳过集成用例，避免在未配置本地凭据的环境（如 CI）产生红灯。
 */
export const integrationConfigured = Boolean(
  apiBase && clientAuth.username && clientAuth.password && account.username && account.password,
)
