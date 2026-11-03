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

  transformers: [transformerDirectives()],

  rules: [
    // 等价于原 tailwind.config.ts 里的 flex 2~9 扩展
    [/^flex-([2-9])$/, ([, d]) => ({ flex: `${d} ${d} 0%` })],
  ],
})
