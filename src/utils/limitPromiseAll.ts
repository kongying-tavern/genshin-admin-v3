import { filter, from, lastValueFrom, mergeMap, toArray } from 'rxjs'

export interface LimitPromiseAllOptions<T> {
  /** 最大并发数 */
  maxRequests?: number
  /** 初始结果，用于初始化并发池 */
  initResult?: T[]
}

/**
 * 限制 promise 并发数，使用 RxJS 操作符进行处理
 *
 * 注意！返回为 null 的项会被过滤
 */
export const limitPromiseAll = async <D, T>(
  data: D[],
  toPromise: (item: D, index: number) => Promise<T | null>,
  { maxRequests = 10, initResult = [] }: LimitPromiseAllOptions<T> = {},
) => {
  const results = await lastValueFrom(
    from(data).pipe(
      mergeMap((item, index) => from(toPromise(item, index)), maxRequests),
      filter((value): value is T => value !== null),
      toArray(),
    ),
  )

  return initResult.concat(results)
}
