import { afterEach, vi } from 'vitest'

// jsdom 未实现 ResizeObserver，部分组件（图表 / 可拖拽窗口等）在挂载时会直接引用它
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  } as unknown as typeof globalThis.ResizeObserver
}

// jsdom 未实现 matchMedia，响应式布局相关逻辑依赖它
if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof globalThis.matchMedia
}

// jsdom 未实现 Worker，而部分工具模块（如 WorkerInterval）在模块初始化时就会创建 worker
if (!globalThis.Worker) {
  globalThis.Worker = class Worker {
    onmessage = null
    onerror = null
    postMessage = () => {}
    terminate = () => {}
    addEventListener = () => {}
    removeEventListener = () => {}
  } as unknown as typeof globalThis.Worker
}

// jsdom 自行实现了 FormData / Blob，但全局 fetch 仍是 Node 的原生实现，
// 直接把 jsdom 的表单体交过去会丢失内容（被序列化成非表单数据）。
// vitest 已提供兼容的 Request（自动把 jsdom FormData / Blob 转成 Node 版本），
// 因此带表单体的请求统一先经过一次 Request 构造再发出。
const nativeFetch = globalThis.fetch
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const { body } = init ?? {}
  if (body instanceof FormData || body instanceof Blob) return nativeFetch(new Request(input, init))
  return nativeFetch(input, init)
}) as typeof globalThis.fetch

// 每个用例结束后清理 DOM，避免残留节点影响后续断言
afterEach(() => {
  document.body.innerHTML = ''
})
