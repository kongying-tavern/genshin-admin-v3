import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 契约测试：系统订阅配置的获取
 *
 * 锁定 `src/api/config/index.ts` 中 `getSystemConfig` 的对外约定：
 * - 请求地址取自 `VITE_CONFIG_ARCHIVE`
 * - 返回值是未经处理的二进制内容（解压由调用方负责）
 * - 超时后主动中止请求，超时时长可配置
 * - 网络层错误原样透出
 *
 * 本文件不发起真实网络请求，也不关心归档的具体内容。
 */

const ARCHIVE_URL = 'https://assets.example.test/system.json.bz2'

/** 构造一个永不响应、仅在 signal 中止时 reject 的 fetch，用于验证超时 */
const createPendingFetch = () => {
  const state: { settled: boolean } = { settled: false }

  const fetchMock = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        state.settled = true
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      })
    })
  })

  return { fetchMock, state }
}

describe('getSystemConfig', () => {
  let getSystemConfig: (typeof import('@/api/config'))['getSystemConfig']

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_CONFIG_ARCHIVE', ARCHIVE_URL)
    ;({ getSystemConfig } = await import('@/api/config'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('向 VITE_CONFIG_ARCHIVE 指定的地址发起带中止信号的请求', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(new Uint8Array([1, 2, 3])),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getSystemConfig()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(ARCHIVE_URL)
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('原样返回二进制内容，不做解压或转码', async () => {
    const payload = new Uint8Array([0x42, 0x5a, 0x68, 0x39, 0x00, 0xff])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(payload)))

    const buffer = await getSystemConfig()

    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(new Uint8Array(buffer)).toEqual(payload)
  })

  it('默认为 10 秒超时，超时后中止请求', async () => {
    vi.useFakeTimers()
    const { fetchMock, state } = createPendingFetch()
    vi.stubGlobal('fetch', fetchMock)

    const request = getSystemConfig()
    const assertion = expect(request).rejects.toMatchObject({ name: 'AbortError' })

    await vi.advanceTimersByTimeAsync(9_999)
    expect(state.settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(state.settled).toBe(true)
    await assertion
  })

  it('支持自定义超时时长', async () => {
    vi.useFakeTimers()
    const { fetchMock, state } = createPendingFetch()
    vi.stubGlobal('fetch', fetchMock)

    const request = getSystemConfig({ timeout: 1_500 })
    const assertion = expect(request).rejects.toMatchObject({ name: 'AbortError' })

    await vi.advanceTimersByTimeAsync(1_499)
    expect(state.settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(state.settled).toBe(true)
    await assertion
  })

  it('网络错误原样透出', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down')
      }),
    )

    await expect(getSystemConfig()).rejects.toThrow('network down')
  })
})
