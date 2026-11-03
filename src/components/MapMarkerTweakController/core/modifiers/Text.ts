import type { ModifierConstructorOptions } from '..'
import { Modifier } from '..'

export interface TextModifierProps {
  matchMultiline?: boolean
  replaceMultiline?: boolean
}

export class TextModifier extends Modifier<TextModifierProps> {
  previewer = defineAsyncComponent(() => import('../PreviewImpls/CommonText.vue'))

  constructor(options: ModifierConstructorOptions<TextModifierProps>) {
    super(options, {
      update: {
        label: '文本更新',
        modify: (data, { value = '' }) => {
          const { field } = this.options
          return { ...data, [field]: value }
        },
        cardComp: () => import('../CardImpls/TextUpdate.vue'),
      },

      replace: {
        label: '文本替换',
        modify: (data, { test = '', replace = '' }) => {
          if (!test) return data
          const { field } = this.options
          return { ...data, [field]: `${data[field]}`.replaceAll(test, replace) }
        },
        cardComp: () => import('../CardImpls/TextReplace.vue'),
      },

      replaceRegex: {
        label: '正则替换',
        modify: (data, { test = '', replace = '' }) => {
          if (!test) return data
          const { field } = this.options
          return { ...data, [field]: `${data[field]}`.replaceAll(new RegExp(test, 'g'), replace) }
        },
        cardComp: () => import('../CardImpls/TextRegExpReplace.vue'),
      },

      prepend: {
        label: '在开头插入',
        modify: (data, { value = '' }) => {
          const { field } = this.options
          return { ...data, [field]: `${value}${data[field]}` }
        },
        cardComp: () => import('../CardImpls/TextUpdate.vue'),
      },

      append: {
        label: '在结尾插入',
        modify: (data, { value = '' }) => {
          const { field } = this.options
          return { ...data, [field]: `${data[field]}${value}` }
        },
        cardComp: () => import('../CardImpls/TextUpdate.vue'),
      },

      trimLeft: {
        label: '去除开头空白字符',
        modify: data => {
          const { field } = this.options
          return { ...data, [field]: `${data[field]}`.trimStart() }
        },
        cardComp: () => import('../CardImpls/StaticAction.vue'),
      },

      trimRight: {
        label: '去除结尾空白字符',
        modify: data => {
          const { field } = this.options
          return { ...data, [field]: `${data[field]}`.trimEnd() }
        },
        cardComp: () => import('../CardImpls/StaticAction.vue'),
      },

      removeLeft: {
        label: '从开头移除文本',
        modify: (data, { test = '' }) => {
          if (!test) return data
          const { field } = this.options
          return { ...data, [field]: `${data[field]}`.replace(test, '') }
        },
        cardComp: () => import('../CardImpls/TextMatch.vue'),
      },

      removeRight: {
        label: '从结尾移除文本',
        modify: (data, { test = '' }) => {
          if (!test) return data
          const { field } = this.options
          const str = `${data[field]}`
          const lastIndex = str.lastIndexOf(test)
          if (lastIndex < 0) return data
          return { ...data, [field]: str.slice(0, lastIndex) + str.slice(lastIndex + test.length) }
        },
        cardComp: () => import('../CardImpls/TextMatch.vue'),
      },
    })
  }
}
