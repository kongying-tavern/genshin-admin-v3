import type { Plugin, ProxyOptions } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import BaseSSL from '@vitejs/plugin-basic-ssl'
import Vue from '@vitejs/plugin-vue'
import { simpleGit } from 'simple-git'
import AutoImport from 'unplugin-auto-import/vite'
import UnoCSS from 'unocss/vite'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { injectAssetsManifest, postcssPlugins } from './plugins'

export default defineConfig(async ({ mode }) => {
  const git = simpleGit()

  const ENV = loadEnv(mode, '.') as ImportMetaEnv

  console.log('[ENV]', ENV)

  const proxy: Record<string, string | ProxyOptions> = {
    [ENV.VITE_API_BASE]: {
      target: ENV.VITE_API_PROXY_TARGET,
      changeOrigin: true,
      rewrite: path => path.replace(new RegExp(`${ENV.VITE_API_BASE}`), ''),
    },
  }

  const plugins: Plugin[] = [
    injectAssetsManifest(),
    // 返回的是插件数组，需要展开
    ...UnoCSS(),
    Vue({
      script: {
        defineModel: true,
      },
      template: {
        compilerOptions: {
          comments: false,
        },
      },
    }),
    AutoImport({
      imports: ['vue', '@vueuse/core', 'vue-router'],
      dts: 'types/auto-imports.d.ts',
    }),
    VitePWA({
      devOptions: {
        enabled: true,
        type: 'module',
        resolveTempFolder: () => 'temp/dev-dist',
      },
      injectRegister: false,
      manifest: false,
      injectManifest: {
        injectionPoint: undefined,
      },
      srcDir: 'src/worker/service',
      filename: 'service.worker.ts',
      strategies: 'injectManifest',
      registerType: 'autoUpdate',
    }),
  ]

  if (ENV.VITE_HTTPS) {
    plugins.push(
      BaseSSL({
        name: 'test',
      }),
    )
  }

  const COMMIT_BRANCH = await git.revparse(['--abbrev-ref', 'HEAD'])
  const COMMIT_HASH = await git.revparse(['--short', 'HEAD'])

  const packageJSON = await fs.readFile('package.json', { encoding: 'utf8' })
  const VERSION = JSON.parse(packageJSON).version as string

  return {
    define: {
      // el-tree-select 内部的 option 组件依赖选项式 API 的 extends 继承 ElOption 的 render，
      // 关闭后会出现 "Component is missing template or render function" 警告且树节点渲染为空白，故必须开启
      __VUE_OPTIONS_API__: true,

      // 在生产环境中关闭 devtools 支持
      __VUE_PROD_DEVTOOLS__: false,

      // 禁用生产版本中水合不匹配的详细警告以优化
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,

      'import.meta.env.APP_VERSION': JSON.stringify(VERSION),
      'import.meta.env.APP_BRANCH': JSON.stringify(COMMIT_BRANCH),
      'import.meta.env.APP_COMMIT_HASH': JSON.stringify(COMMIT_HASH),
    },

    server: {
      host: '0.0.0.0',
      port: 9000,
      cors: true,
      proxy,
    },

    preview: {
      host: '0.0.0.0',
      port: 13101,
      cors: true,
      proxy,
    },

    build: {
      rollupOptions: {
        output: {
          // Rolldown 不再支持 `manualChunks` 的对象写法，改用 `codeSplitting.groups`。
          // 先声明的分组优先级更高，因此把会被其他包依赖的公共包（如 vue）放在最前面。
          codeSplitting: {
            groups: [
              { name: 'vue', test: /node_modules[\\/](?:vue|vue-router|pinia)[\\/]/ },
              {
                name: 'element-plus-icons',
                test: /node_modules[\\/]@element-plus[\\/]icons-vue[\\/]/,
              },
              { name: 'element-plus', test: /node_modules[\\/]element-plus[\\/]/ },
              { name: 'deck', test: /node_modules[\\/]deck\.gl[\\/]/ },
              { name: 'dexie', test: /node_modules[\\/]dexie[\\/]/ },
              { name: 'rxjs', test: /node_modules[\\/]rxjs[\\/]/ },
              { name: 'antv-pattern', test: /node_modules[\\/]@antv[\\/]g-pattern[\\/]/ },
              { name: 'antv-g2', test: /node_modules[\\/]@antv[\\/]g2[\\/]/ },
              { name: 'antv-g6', test: /node_modules[\\/]@antv[\\/]g6[\\/]/ },
              { name: 'antv-s2', test: /node_modules[\\/]@antv[\\/]s2[\\/]/ },
              {
                name: 'tiptap',
                test: /node_modules[\\/]@tiptap[\\/](?:core|extension-text-align|starter-kit|vue-3)[\\/]/,
              },
              { name: 'vueuse', test: /node_modules[\\/]@vueuse[\\/](?:core|rxjs)[\\/]/ },
            ],
          },
        },
      },
    },

    resolve: {
      alias: [
        {
          find: /^@\//,
          replacement: `${path.resolve(__dirname, 'src')}/`,
        },
      ],
    },

    css: {
      // 嵌套必须在 Vue 的 scoped 编译之前拍平，否则 :deep() 会退化成后代选择器。
      // 详见 plugins/postcss.ts 与 tests/style/scoped-deep.test.ts。
      postcss: {
        plugins: postcssPlugins(),
      },
    },

    plugins,

    optimizeDeps: {
      // 在启动时预打包这些仅被 Web Worker 动态引用的依赖，
      // 避免运行时首次加载 worker 时触发重新优化导致整页刷新
      include: ['socket.io-client', '7z-wasm'],
    },
  }
})
