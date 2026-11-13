import type { AcceptedPlugin } from 'postcss'
import postcssNested from 'postcss-nested'

/**
 * 应用的 PostCSS 插件集合（由 `vite.config.ts` 的 `css.postcss` 使用）。
 *
 * 这里必须保留 `postcss-nested`，原因是它决定了 `:deep()` 能否正常工作：
 *
 * Vue 的 scoped 编译无法正确处理「仍处于嵌套状态」的 `:deep()`。
 * 对
 *
 * ```scss
 * .a { :deep(.el-b) { color: red } }
 * ```
 *
 * 它会产出 `.a { [data-v-xxx] .el-b {…} }`，在原生 CSS 嵌套语义下等价于
 * `.a [data-v-xxx] .el-b`——`[data-v-xxx]` 变成了**后代**选择器而不是挂在 `.a` 上，
 * 于是覆盖只在「`.a` 内部恰好存在一个带 scope 属性的中间元素」时才偶然命中，
 * 其余情况全部失效。
 *
 * 正确做法是在 scoped 编译**之前**先把嵌套拍平成单层选择器
 * （`.a :deep(.el-b)`），Vue 便会输出 `.a[data-v-xxx] .el-b`。
 *
 * 迁移到 UnoCSS 之前，这一步由已删除的 `postcss.config.js` 中的
 * `tailwindcss/nesting` 承担；迁移时 postcss 配置被整体移除，导致全项目
 * 所有写在嵌套里的 `:deep()` 覆盖失效。`tests/style/scoped-deep.test.ts`
 * 会对该行为做回归校验。
 */
export const postcssPlugins = (): AcceptedPlugin[] => [postcssNested()]
