import type { Plugin } from 'vue'

/** 类型补丁 */
declare const CSS: {
  paintWorklet: Worklet
}

const modules = import.meta.glob<boolean, string, string>('@/style/CSSHoudini/*.js', {
  query: '?raw',
  import: 'default',
})

/** 注册自定义背景绘制类 */
export const customPaint = (): Plugin => ({
  install: () => {
    if (!('paintWorklet' in CSS)) return
    Object.values(modules).forEach(async module => {
      const code = await module()
      CSS.paintWorklet.addModule(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`)
    })
  },
})
