import type { ModifierConstructorOptions } from '..'
import { Modifier } from '..'

export interface EnumModifierProps<T> {
  options: {
    label: string
    value: T
  }[]
  optionMap: Map<T, string>
}

export class EnumModifier<T = unknown> extends Modifier<EnumModifierProps<T>> {
  previewer = defineAsyncComponent(() => import('../PreviewImpls/EnumValue.vue'))

  constructor(options: ModifierConstructorOptions<EnumModifierProps<T>>) {
    super(options, {
      update: {
        label: '更新',
        modify: (data, { value = '' }) => {
          const { field, customModify } = this.options
          if (customModify !== undefined) return data
          return { ...data, [field]: value }
        },
        cardComp: () => import('../CardImpls/EnumUpdate.vue'),
      },
    })
  }
}
