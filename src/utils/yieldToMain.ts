/**
 * 让出主线程，使浏览器有机会处理输入与渲染
 *
 * 优先使用 Chromium 的 `scheduler.yield()`（优先级继承、恢复更快），
 * 其余浏览器回退到 `setTimeout(0)`。
 *
 * @note 不要直接调用 `scheduler.yield()`，Safari / Firefox 上 `scheduler` 未定义，
 * 会抛出 ReferenceError 并导致整条数据处理流程中断
 */
export const yieldToMain = async (): Promise<void> => {
  const api = typeof scheduler === 'undefined' ? undefined : scheduler
  if (typeof api?.yield === 'function') {
    await api.yield()
    return
  }
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}
