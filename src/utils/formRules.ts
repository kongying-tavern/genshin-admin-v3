import type { Arrayable } from '@vueuse/core'
import type { FormItemRule } from 'element-plus'

export type Trigger = 'blur' | 'change' | 'active'

export type ItemFormRules<T> = {
  [P in keyof T]?: Arrayable<FormItemRule>
}

export const requireCheck = (trigger: Trigger, name: string) => ({
  required: true,
  message: `${name}不能为空`,
  trigger,
})

export const lengthCheck = (
  trigger: Trigger,
  name: string,
  max: number,
  min = 1,
): FormItemRule => ({
  required: true,
  message: `${name}需要 ${min} - ${max} 个非空白字符`,
  pattern: new RegExp(`\\S{${min},${max}}`),
  trigger,
})

export const emptyCheck = (name = '', trigger: Trigger = 'blur') => ({
  message: `${name}不能含有空白字符`,
  pattern: /^\S+$/,
  trigger,
})

export const qqCheck = (): FormItemRule => ({
  required: true,
  message: '必须为 10000-9999999999 之间的号码',
  validator: (_, value = '') => {
    const qq = Number(value)
    return qq >= 10000 && qq <= 99999999999
  },
})

export const passwordCheck = (): FormItemRule => ({
  required: true,
  message: '密码至少需要6个字符',
  validator: (_, v = '') => v.length >= 6,
})
