export {}

/** 工具类型 */
declare global {
  /** 递归类型使其所有键值均为必填 */
  type DeepRequired<T> = {
    [P in keyof T]-?: DeepRequired<T[P]>
  }

  /** 提取数组项 */
  type Item<T> = T extends unknown[] ? T[number] : T

  /** 下划线风格转换为小驼峰风格 */
  type SnakeCaseToCamelCase<S> = S extends `${infer Prefix}_${infer Rest}`
    ? `${SnakeCaseToCamelCase<Prefix>}${Capitalize<SnakeCaseToCamelCase<Rest>>}`
    : S

  /** 转换对象的所有下划线风格 key 为小驼峰风格的 key */
  type SnakeCaseKeysToCamelCase<T extends Record<string, unknown>> = {
    [K in keyof T as SnakeCaseToCamelCase<K>]: T[K]
  }

  /** 将普通对象内的值全部转换为响应式 */
  type ToRefDestructure<T> = {
    [K in keyof T]: Ref<T[K]>
  }

  /** 将 Map 转换为固定格式的配置对象 */
  type MapToSchema<T> = {
    [K in keyof T]: {
      type: K
      value: T[K]
    }
  }[keyof T]
}
