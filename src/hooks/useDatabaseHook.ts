import type { Dexie, Transaction } from 'dexie'

type DexieTableHookType = 'creating' | 'deleting' | 'updating'

const isTransaction = (v: unknown): v is Transaction => {
  if (v === null) return false
  if (typeof v !== 'object') return false
  return 'on' in v && typeof v.on === 'function'
}

export const useDatabaseHook = (
  table: Dexie.Table,
  cb: () => void,
  types: DexieTableHookType[],
) => {
  // 确保 callback 在事务完成后才被调用
  const rewriteCallback = (...args: unknown[]) => {
    const maybeTransaction = args.at(-1)

    if (!isTransaction(maybeTransaction)) return cb()

    maybeTransaction.on('complete', cb)
  }

  onActivated(() => {
    types.forEach(hookType => table.hook(hookType).subscribe(rewriteCallback))
  })

  onDeactivated(() => {
    types.forEach(hookType => table.hook(hookType).unsubscribe(rewriteCallback))
  })
}
