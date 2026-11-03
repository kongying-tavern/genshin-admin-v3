import type { MarkerVo, TweakConfigMetaVo, TweakConfigVo } from '@/api/alova/globals'
import type { GSMarkerInfo } from '@/packages/map'

export type ModifierConstructorOptions<T = void> = {
  /** 旧内容表头 */
  label: string
  /**
   * 新内容表头
   * @default '修改为'
   */
  replaceLabel?: string
  /**
   * 预览项的高度
   * @default 32
   */
  previewHeight?: number
  /** 字段名 */
  field: keyof GSMarkerInfo
  /** 修改类型 */
  type: string
  /** 用于自定义修改行为，当设置此值时，将会跳过通过接口进行的修改 */
  customModify?: (markers: MarkerVo[], meta: TweakConfigMetaVo) => void | Promise<void>
  /** 将会覆盖 Modifier 的 getValue 行为 */
  customGetValue?: (data: GSMarkerInfo, isOld: boolean, meta?: TweakConfigMetaVo) => unknown
} & T

interface Strategy<T> {
  label: string
  modify: (data: T, meta: Required<TweakConfigVo>['meta']) => T
  cardComp: () => Promise<Component>
}

export abstract class Modifier<T = void> {
  options: Required<ModifierConstructorOptions<T>>

  abstract previewer: Component
  card: Component
  typeLabel: string
  modify: Strategy<GSMarkerInfo>['modify']

  getValue = (data: GSMarkerInfo, isOld: boolean, meta?: TweakConfigMetaVo) => {
    const { field, customGetValue } = this.options
    if (customGetValue) return customGetValue(data, isOld, meta)
    return data[field]
  }

  constructor(
    options: ModifierConstructorOptions<T>,
    strategies: Record<string, Strategy<GSMarkerInfo>>,
  ) {
    const { replaceLabel = '修改为', ...rest } = options

    this.options = {
      ...rest,
      replaceLabel,
    } as Required<ModifierConstructorOptions<T>>

    const strategy = strategies[this.options.type]
    if (!strategy) throw new Error(`字段 "${this.options.field}" 未实现策略 "${this.options.type}"`)

    this.card = defineAsyncComponent(strategy.cardComp)
    this.typeLabel = strategy.label
    this.modify = strategy.modify
  }
}
