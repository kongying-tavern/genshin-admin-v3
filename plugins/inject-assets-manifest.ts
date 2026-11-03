import type { Plugin, ResolvedConfig } from 'vite'

/**
 * 构建时注入产物清单到 HTML，供首屏内联脚本读取以展示模块加载进度。
 *
 * 修复说明：
 * - 通过 configResolved 捕获 base 路径，避免硬编码 `/`，
 *   从而兼容部署到子路径（如域名的 `/app/` 目录）的场景。
 */
export const injectAssetsManifest = (): Plugin => {
  let base = '/'

  return {
    name: 'inject-assets-manifest',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      base = config.base
    },
    transformIndexHtml(html, { bundle }) {
      if (!bundle) return html

      const assets = Object.values(bundle)
        .filter(chunk => !chunk.fileName.endsWith('.wasm'))
        .map(chunk => `${base}${chunk.fileName}`)
      const script = `<script>window.__ASSETS_MANIFEST__ = ${JSON.stringify(assets)};</script>`
      return html.replace('</head>', `${script}\n</head>`)
    },
  }
}
