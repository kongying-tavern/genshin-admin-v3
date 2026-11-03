import type { Directive } from 'vue'

const handleCopy = (ev: ClipboardEvent) => {
  const data = ev.clipboardData
  if (!data) return
  // 只对纯文本复制生效，包含其他类型（如富文本、图片等）时不拦截
  const types = Array.from(data.types)
  if (types.some(t => t.startsWith('text'))) return
  const selection = document.getSelection()
  if (!selection) return
  const cleanText = selection.toString().trim()
  if (!cleanText) return
  data.setData('text/plain', cleanText)
  ev.preventDefault()
}

/**
 * 自定义指令：复制时自动去除首尾空白
 * 用法：v-copy-clean-text
 */
export const vCopyCleanText: Directive = {
  mounted(el: HTMLElement) {
    el.addEventListener('copy', handleCopy)
  },
  unmounted(el: HTMLElement) {
    el.removeEventListener('copy', handleCopy)
  },
}
