import { defineConfig, presetWind4, transformerDirectives } from 'unocss'

export default defineConfig({
  content: {
    pipeline: {
      // 与迁移前 Tailwind 的 content 扫描范围保持一致
      include: [/\.(vue|html)($|\?)/, /\.[jt]sx?($|\?)/],
      exclude: [
        // 样式文件不参与“类名提取”，@apply 由 transformerDirectives 处理
        /\.(css|postcss|sass|scss|less|stylus|styl)($|\?)/,
        /node_modules/,
        /[\\/](?:dist|temp|coverage|reference)[\\/]/,
      ],
    },
  },

  presets: [
    presetWind4({
      preflights: {
        // 改用 @unocss/reset/tailwind.css 提供与 Tailwind v3 一致的 preflight，
        // 避免 wind4 内置的 v4 版 reset 改变默认边框颜色、button 光标等既有表现
        reset: false,
      },
    }),
  ],

  // wind4 采用 Tailwind v4 的主题语义，这里恢复迁移前 v3 的取值
  theme: {
    // v3 中 rounded-sm 为 0.125rem（v4 为 0.25rem）
    radius: {
      sm: '0.125rem',
    },
    // v3 中 shadow-sm 为 0 1px 2px 0 rgb(0 0 0 / 0.05)（v4 改为旧 shadow 的取值）
    shadow: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    },
  },

  preflights: [
    {
      // reset 的 `[type='button']` 规则与 .el-button 特异性相同，
      // 而生产构建中 main.css 晚于 element-plus.css 注入，会将其背景色覆盖为透明。
      // 在工具类之前显式恢复 Element Plus 的按钮背景，保证各环境表现一致。
      getCSS: () => '.el-button{background-color:var(--el-button-bg-color)}',
    },
  ],

  transformers: [transformerDirectives()],

  rules: [
    // 等价于原 tailwind.config.ts 里的 flex 2~9 扩展
    [/^flex-([2-9])$/, ([, d]) => ({ flex: `${d} ${d} 0%` })],
  ],
})
