/// <reference types="vite/client" />

/** 拓展 ENV 环境变量对象的类型 */
interface ImportMetaEnv {
  /** @dev 地区标签保存路径，仅在 Vite 开发服务器中定义 */
  readonly AREA_TAG_EDITOR?: string

  /** 标题 */
  readonly VITE_TITLE: string

  /** 内嵌文档地址  */
  readonly VITE_DOCUMENT_URL: string

  /** @dev 是否启用 HTTPS */
  readonly VITE_HTTPS?: '0' | '1'

  /** 接口地址 */
  readonly VITE_API_BASE: string

  /** @dev 接口反代理 */
  readonly VITE_API_PROXY_TARGET: string

  /** 已通过当前后端和可见范围的归档契约验证，可按资源启用 */
  readonly VITE_MAP_ENTITY_ARCHIVES?: string

  /** 路由创建历史记录的模式 */
  readonly VITE_ROUTER_MODE: 'history' | 'hash' | 'memory'

  /** 个人信息面板 banner 展示图 */
  readonly VITE_BANNER_IMAGE: string

  /** @dev 下自动填充用户名 */
  readonly VITE_AUTO_COMPLETE_USERNAME: string

  /** @dev 下自动填充密码 */
  readonly VITE_AUTO_COMPLETE_PASSWORD: string

  /** 资源服务器地址 */
  readonly VITE_ASSETS_BASE: string

  /** @dev 网络模式 */
  readonly VITE_DEVELOPMENT_MODE: 'default' | 'offline'

  /** API 前置账号 */
  readonly VITE_API_AUTH_USERNAME: string

  /** API 前置口令 */
  readonly VITE_API_AUTH_PASSWORD: string

  /** WebSocket 地址 */
  readonly VITE_WS_BASE: string

  /**
   * AI 页面句柄默认模式（off | read | write）
   * - 未设置时：开发环境 write，生产环境 off
   */
  readonly VITE_AI_BRIDGE?: string

  /** @test 接口集成测试账号 */
  readonly VITE_TEST_USERNAME: string

  /** @test 接口集成测试口令 */
  readonly VITE_TEST_PASSWORD: string

  /** @ignore */
  readonly APP_VERSION: string
  /** @ignore */
  readonly APP_BRANCH: string
  /** @ignore */
  readonly APP_COMMIT_HASH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
