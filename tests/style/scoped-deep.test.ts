import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import * as sass from 'sass'
import { compileStyle, parse as parseSFC } from 'vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { postcssPlugins } from '../../plugins/postcss'

/**
 * 回归测试：`:deep()` 的 scoped 编译结果
 *
 * 背景：从 Tailwind v3 迁移到 UnoCSS 时，`postcss.config.js` 连同其中的
 * `tailwindcss/nesting` 一起被删除，导致嵌套规则不再被提前拍平。
 * Vue 的 scoped 编译拿到「嵌套状态」的 `:deep()` 时，会把 `[data-v-xxx]`
 * 当成后代选择器插入：
 *
 *   源        `.a { :deep(.el-b) {…} }`
 *   错误产物  `.a [data-v-xxx] .el-b`   ← 只有当 .a 内部存在带 scope 的中间元素时才偶然命中
 *   正确产物  `.a[data-v-xxx] .el-b`
 *
 * 该错误在构建产物里几乎不可见（选择器依旧合法），只会表现为「Element Plus 样式覆盖失效」，
 * 因此用测试锁住：任何写在 `<style scoped>` 里的 `:deep()` 都必须编译成
 * 「scope 属性紧跟在锚点选择器之后」的形式。
 */

const SRC = path.resolve(import.meta.dirname, '../../src')

function walkVueFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walkVueFiles(full, out)
    else if (full.endsWith('.vue')) out.push(full)
  }
  return out
}

interface DeepCase {
  file: string
  /** 拍平后、未经 scoped 编译的完整选择器，如 `.a :deep(.el-b)` */
  selector: string
}

/** 收集所有组件样式块中经真实 PostCSS 管线处理后的 `:deep()` 选择器 */
function collectDeepSelectors(): DeepCase[] {
  const cases: DeepCase[] = []

  for (const file of walkVueFiles(SRC)) {
    const source = readFileSync(file, 'utf8')
    if (!source.includes(':deep(')) continue

    const { descriptor } = parseSFC(source, { filename: file })
    for (const block of descriptor.styles) {
      if (!block.content.includes(':deep(')) continue

      const css = block.lang === 'scss' ? sass.compileString(block.content).css : block.content
      const flattened = postcss(postcssPlugins()).process(css, { from: undefined }).css

      postcss.parse(flattened).walkRules(rule => {
        for (const selector of rule.selector.split(',')) {
          if (selector.includes(':deep(')) {
            cases.push({
              file: path.relative(path.resolve(SRC, '..'), file).replace(/\\/g, '/'),
              selector: selector.trim(),
            })
          }
        }
      })
    }
  }

  return cases
}

describe('SCSS 嵌套拍平', () => {
  it('PostCSS 管线包含 postcss-nested（缺失会让所有 :deep() 覆盖失效）', () => {
    const names = postcssPlugins().map(
      plugin => (plugin as { postcssPlugin?: string }).postcssPlugin,
    )
    expect(names).toContain('postcss-nested')
  })
})

describe(':deep() 的 scoped 编译', () => {
  const cases = collectDeepSelectors()

  it('确实扫描到了组件的深度选择器', () => {
    expect(cases.length).toBeGreaterThan(50)
  })

  it('每条 :deep() 的锚点都带上 scope 属性', () => {
    const broken: string[] = []

    for (const { file, selector } of cases) {
      const compiled = compileStyle({
        source: `${selector} {}`,
        filename: file,
        id: 'data-v-test',
        scoped: true,
      }).code.trim()

      const anchor = selector.split(':deep(')[0].trim()
      // 锚点为空（`:deep()` 直接写在根上）或 scope 属性没有紧跟锚点，都视为失效
      if (!anchor || !compiled.startsWith(`${anchor}[data-v-test]`)) {
        broken.push(`${file}: ${selector}\n      产物: ${compiled.split('\n')[0]}`)
      }
    }

    expect(broken).toEqual([])
  })
})
