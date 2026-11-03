interface Options {
  /** @default `__hash` */
  hashKey?: string
  /** @default `updateTime` */
  timeKey?: string
}

export interface HashGroupMeta<T> {
  time: number
  list: T[]
}

export const createHashGroupMap = <T extends object>(rawList: T[], options: Options = {}) => {
  const { hashKey = '__hash', timeKey = 'updateTime' } = options
  const result = new Map<string, HashGroupMeta<T>>()
  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i]
    const hash = Reflect.get(item, hashKey) as string
    const time = new Date(Reflect.get(item, timeKey) as number).getTime()
    if (!result.has(hash)) {
      result.set(hash, { time, list: [item] })
      continue
    }
    const group = result.get(hash)!
    if (time > group.time) group.time = time
    group.list.push(item)
  }
  return result
}
