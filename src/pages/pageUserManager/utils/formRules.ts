import type { FormItemRule } from 'element-plus'

export type Trigger = 'blur' | 'change' | 'active'

export const lengthCheck = (
  name: string,
  len: number,
  trigger: Trigger = 'blur',
): FormItemRule => ({
  required: true,
  message: `${name}至少需要 ${len} 个字符`,
  pattern: new RegExp(`\\S{${len}}`),
  trigger,
})

export const emptyCheck = (name = '', trigger: Trigger = 'blur') => ({
  message: `${name}不能含有空白字符`,
  pattern: /^\S+$/,
  trigger,
})
