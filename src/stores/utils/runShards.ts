import { messageFrom, sleep, yieldToMain } from '@/utils'

/** 分片失败信息 */
export interface ShardFailure {
  /** 分片在原数组中的下标 */
  index: number
  /** 最终失败原因 */
  error: Error
  /** 该分片已尝试的次数 */
  attempts: number
}

export interface ShardSettledInfo {
  /** 已结束（成功 + 失败）的分片数量 */
  finished: number
  /** 分片总数 */
  total: number
  /** 其中失败的分片数量 */
  failed: number
}

export interface RunShardsOptions<TShard, TResult> {
  /** 待处理的分片列表 */
  shards: TShard[]
  /** 单个分片的处理逻辑，抛错即视为该次尝试失败 */
  run: (shard: TShard, index: number) => Promise<TResult>
  /** 最大并发数 @default 4 */
  concurrency?: number
  /** 单个分片的最大尝试次数，`1` 表示不重试 @default 3 */
  retryLimit?: number
  /** 重试的基础间隔（毫秒），按指数退避递增 @default 600 */
  retryDelay?: number
  /** 单次尝试的超时时间（毫秒），`0` 表示不限制 @default 20000 */
  timeout?: number
  /** 返回 true 时不再领取新分片（已领取的分片仍会走完重试流程） */
  shouldAbort?: () => boolean
  /** 单个分片成功时触发，抛错会被记录为该分片的失败 */
  onSuccess?: (result: TResult, index: number) => void | Promise<void>
  /** 单个分片在耗尽重试后触发 */
  onFailure?: (failure: ShardFailure, shard: TShard) => void
  /** 任一碎片结束（无论成败）时触发，用于驱动进度反馈 */
  onSettled?: (info: ShardSettledInfo) => void
}

export interface RunShardsResult<TResult> {
  /** 成功的分片结果，顺序为完成顺序 */
  results: TResult[]
  /** 最终失败的分片 */
  failures: ShardFailure[]
}

/** 将数组按固定长度切分为若干分片 */
export const chunk = <T>(list: readonly T[], size: number): T[][] => {
  if (size <= 0) return [list.slice()]
  const res: T[][] = []
  for (let i = 0; i < list.length; i += size) res.push(list.slice(i, i + size))
  return res
}

/** 给 promise 附加超时，超时后以错误拒绝（不会中断底层请求） */
const withTimeout = <T>(promise: Promise<T>, timeout: number) => {
  if (!timeout) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`请求超时 (${timeout}ms)`)), timeout)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export interface RetryOptions {
  /** 最大尝试次数，`1` 表示不重试 @default 3 */
  retryLimit?: number
  /** 重试的基础间隔（毫秒），按指数退避递增 @default 600 */
  retryDelay?: number
  /** 单次尝试的超时时间（毫秒），`0` 表示不限制 @default 20000 */
  timeout?: number
}

/** 对单个异步任务做指数退避重试，最终仍失败时抛出最后一次的错误 */
export const retry = async <T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const { retryLimit = 3, retryDelay = 600, timeout = 20_000 } = options
  const limit = Math.max(1, retryLimit)
  let lastError = new Error('未知错误')
  for (let attempt = 1; attempt <= limit; attempt++) {
    try {
      return await withTimeout(task(), timeout)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(messageFrom(err))
      if (attempt < limit) await sleep(retryDelay * 2 ** (attempt - 1))
    }
  }
  throw lastError
}

/**
 * # 分片任务执行器
 *
 * 与 `Promise.all` 的区别：
 * - 限制并发，避免瞬时打满连接池
 * - 单个分片失败会按指数退避重试，最终失败也只影响自己，不会中断其他分片
 * - 每个分片结束即可通过 `onSuccess` 消费，支持「边拉取边应用」的渐进式更新
 */
export const runShards = async <TShard, TResult>(
  options: RunShardsOptions<TShard, TResult>,
): Promise<RunShardsResult<TResult>> => {
  const {
    shards,
    run,
    concurrency = 4,
    retryLimit = 3,
    retryDelay = 600,
    timeout = 20_000,
    shouldAbort,
    onSuccess,
    onFailure,
    onSettled,
  } = options

  const { length: total } = shards
  const results: TResult[] = []
  const failures: ShardFailure[] = []

  let cursor = 0
  let finished = 0

  const settle = () => {
    finished += 1
    onSettled?.({ finished, total, failed: failures.length })
  }

  const execute = async (shard: TShard, index: number) => {
    const attemptsLimit = Math.max(1, retryLimit)
    for (let attempt = 1; attempt <= attemptsLimit; attempt++) {
      try {
        const result = await withTimeout(run(shard, index), timeout)
        try {
          await onSuccess?.(result, index)
        } catch (err) {
          // 数据已经取回，仅落盘/应用失败：重试是幂等的，但错误信息需要区分开
          throw new Error(`应用分片数据失败: ${messageFrom(err)}`)
        }
        results.push(result)
        return
      } catch (err) {
        const error = err instanceof Error ? err : new Error(messageFrom(err))
        // 最后一次尝试，或外部要求中断
        if (attempt >= attemptsLimit || shouldAbort?.()) {
          const failure: ShardFailure = { index, error, attempts: attempt }
          failures.push(failure)
          onFailure?.(failure, shard)
          return
        }
        await sleep(retryDelay * 2 ** (attempt - 1))
      }
    }
  }

  const worker = async () => {
    for (;;) {
      if (shouldAbort?.()) return
      const index = cursor++
      if (index >= total) return
      try {
        await execute(shards[index], index)
      } finally {
        settle()
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, total))
  await Promise.all(Array.from({ length: workerCount }, worker))

  return { results, failures }
}

/**
 * 将长数组按块处理，块与块之间让出主线程
 *
 * 用于「数据已经到手，但一次性写入会长时间阻塞主线程」的场景
 */
export const forEachChunk = async <T>(
  list: readonly T[],
  size: number,
  handler: (items: T[], info: { index: number; total: number }) => void | Promise<void>,
  options: { shouldAbort?: () => boolean } = {},
) => {
  const shards = chunk(list, size)
  const { length: total } = shards
  for (let i = 0; i < total; i++) {
    if (options.shouldAbort?.()) return
    await handler(shards[i], { index: i, total })
    await yieldToMain()
  }
}
