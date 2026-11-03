import type { Plugin } from 'vite'
import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vitest/config'

/**
 * Vitest 独立配置
 *
 * 不直接复用 `vite.config.ts`：
 * 应用配置中包含 PWA 插件、Git 信息注入、开发服务器代理等与测试无关的逻辑，
 * 混入测试会导致启动缓慢且引入不必要的副作用。
 *
 * 测试代码统一放置在根目录 `tests/` 中，与 `src/` 源码目录分离。
 * 按测试性质拆分为多个 project（unit / api-contract / api-integration），
 * 便于分别运行，也让集成测试可以单独关闭文件级并行。
 */

/** 与应用保持一致，提供 .vue 编译与自动导入能力 */
const createPlugins = (): Plugin[] => [
  Vue({
    script: {
      defineModel: true,
    },
    template: {
      compilerOptions: {
        comments: false,
      },
      // 测试中不需要打包资源：模板里的图片地址保持为字符串即可。
      // 若不关闭，`<img src="/favicon.ico">` 这类根路径会被改写为 import，
      // 而 vitest 的 node 运行器无法解析（createRequire 收到 file:///favicon.ico）。
      transformAssetUrls: false,
    },
  }) as Plugin,

  AutoImport({
    imports: ['vue', '@vueuse/core', 'vue-router'],
    dts: 'types/auto-imports.d.ts',
  }),
]

/** `@/` 指向 `src/` */
const alias = [
  {
    find: /^@\//,
    replacement: `${path.resolve(import.meta.dirname, 'src')}/`,
  },
]

/** 各 project 共享的测试选项 */
const sharedTestOptions = {
  // 组件测试与接口测试均依赖 DOM / localStorage 等浏览器 API
  environment: 'jsdom',
  // 全局初始化文件（补齐 jsdom 缺失的浏览器 API）
  setupFiles: ['./tests/setup.ts'],
  // 每个测试文件使用独立环境，避免模块级状态互相污染
  isolate: true,
  // 每个用例前自动还原 spy，避免用例之间互相影响
  restoreMocks: true,
}

export default defineConfig({
  test: {
    projects: [
      {
        // 单元测试：组件、工具函数等纯本地逻辑
        plugins: createPlugins(),
        resolve: { alias },
        test: {
          name: 'unit',
          ...sharedTestOptions,
          include: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx,vue}'],
          // 接口测试由下方两个 project 负责
          exclude: ['**/node_modules/**', '**/dist/**', 'tests/api/**'],
        },
      },

      {
        // 接口契约测试：离线校验请求构造 / 响应处理逻辑，不发起真实网络请求
        plugins: createPlugins(),
        resolve: { alias },
        test: {
          name: 'api-contract',
          ...sharedTestOptions,
          include: ['tests/api/contract/**/*.test.ts'],
        },
      },

      {
        // 接口集成测试：真实请求 dev 后端
        plugins: createPlugins(),
        resolve: { alias },
        test: {
          name: 'api-integration',
          ...sharedTestOptions,
          include: ['tests/api/integration/**/*.test.ts'],
          // 集成用例会真实创建 / 删除后端数据，必须串行执行以免相互干扰
          fileParallelism: false,
          // 真实网络请求耗时波动较大，放宽超时限制
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/api/protobuf/**', 'src/**/*.d.ts', 'types/**'],
    },
  },
})
