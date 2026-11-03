/** 掩码操作工具类 */
export class BinaryMask<T extends string = string> {
  constructor(maskKeys: T[]) {
    if (maskKeys.length < 0) throw new Error('掩码配置数组不能为空')
    this.#indexMap = maskKeys.reduce((map, key, index) => {
      return map.set(key, index)
    }, new Map<T, number>())
  }

  #indexMap: Map<T, number>

  #assertInteger = (mask: number) => {
    if (!Number.isInteger(mask)) throw new Error(`掩码必须是整数`)
  }

  /** 判断某个 key 在给定的二进制掩码上是否处于激活状态 */
  isActive = (mask: number, key: T): boolean => {
    this.#assertInteger(mask)
    const index = this.#indexMap.get(key)
    if (index === undefined) return false
    return (mask & (1 << index)) !== 0
  }

  /**
   * 激活给定的 key 在掩码中对应的位。
   * 如果给定的 key 不存在于掩码配置中，则直接返回。
   */
  active = (mask: number, key: T): number => {
    this.#assertInteger(mask)
    const index = this.#indexMap.get(key)
    if (index === undefined) return mask
    return mask | (1 << index)
  }

  /**
   * 禁用给定的 key 在掩码中对应的位。
   * 如果给定的 key 不存在于掩码配置中，则直接返回。
   */
  inactive = (mask: number, key: T): number => {
    this.#assertInteger(mask)
    const index = this.#indexMap.get(key)
    if (index === undefined) return mask
    return mask & ~(1 << index)
  }

  /**
   * 将掩码解码为功能 key 列表
   */
  decode = (mask: number) => {
    const keys: T[] = []
    this.#indexMap.forEach((_, key) => {
      const isActive = this.isActive(mask, key)
      isActive && keys.push(key)
    })
    return keys
  }

  /**
   * 通过配置友好的方式构造一个初始掩码
   */
  build = (options: Record<T, boolean | undefined>): number => {
    let mask = 0
    for (const key in options)
      mask = options[key] ? this.active(mask, key) : this.inactive(mask, key)
    return mask
  }
}
