import { flushPromises, mount } from '@vue/test-utils'
import { ElNotification } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useAppVersionCheck } from '@/hooks/useAppVersionCheck'

vi.mock('element-plus', () => ({
  ElButton: 'button',
  ElNotification: vi.fn(),
}))

const fetchVersion = vi.fn<typeof fetch>()
const notify = vi.mocked(ElNotification)
const closeNotification = vi.fn()
const versionResponse = (buildId: string) => Response.json({ version: '4.23.0', buildId })

let unmount: (() => void) | undefined
const mountChecker = () => {
  const wrapper = mount(
    defineComponent({
      setup() {
        useAppVersionCheck()
        return () => null
      },
    }),
  )
  unmount = () => wrapper.unmount()
}

const reconnect = async () => {
  window.dispatchEvent(new Event('online'))
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('APP_BUILD_ID', 'running')
  vi.stubEnv('BASE_URL', '/tools/')
  vi.stubGlobal('fetch', fetchVersion.mockReset())
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  closeNotification.mockClear()
  notify.mockReset().mockReturnValue({ close: closeNotification })
})

afterEach(() => {
  unmount?.()
  unmount = undefined
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('前端发版探测', () => {
  it('打开时检查部署路径，轮询发现同版本号的新构建后只提示一次', async () => {
    fetchVersion
      .mockResolvedValueOnce(versionResponse('running'))
      .mockImplementation(async () => versionResponse('deployed'))
    mountChecker()
    await flushPromises()

    expect(fetchVersion).toHaveBeenCalledOnce()
    const [url, options] = fetchVersion.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/tools/version.json')
    expect(options?.cache).toBe('no-store')
    expect(notify).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(fetchVersion.mock.calls[1][0]).not.toBe(url)
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '应用有新版本',
        duration: 0,
        message: expect.any(Function),
      }),
    )

    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(fetchVersion).toHaveBeenCalledTimes(3)
    expect(notify).toHaveBeenCalledOnce()
  })

  it('在后台或离线时跳过检查，回到前台或网络恢复时检查', async () => {
    const setHidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    const setOnline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    fetchVersion.mockImplementation(async () => versionResponse('running'))
    mountChecker()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(fetchVersion).not.toHaveBeenCalled()

    setHidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(fetchVersion).not.toHaveBeenCalled()

    setOnline.mockReturnValue(true)
    await reconnect()
    expect(fetchVersion).toHaveBeenCalledOnce()

    document.dispatchEvent(new Event('visibilitychange'))
    expect(fetchVersion).toHaveBeenCalledTimes(2)
  })

  it('忽略网络异常、非成功状态和无效版本文件，并在下次检查时重试', async () => {
    fetchVersion
      .mockRejectedValueOnce(new TypeError('网络异常'))
      .mockResolvedValueOnce(new Response('{"buildId":"deployed"}', { status: 503 }))
      .mockResolvedValueOnce(new Response('<!DOCTYPE html>'))
      .mockResolvedValueOnce(Response.json({ buildId: ' ' }))
      .mockResolvedValueOnce(versionResponse('deployed'))
    mountChecker()
    await flushPromises()
    await reconnect()
    await reconnect()
    await reconnect()
    expect(notify).not.toHaveBeenCalled()

    await reconnect()
    expect(notify).toHaveBeenCalledOnce()
  })

  it('合并并发检查，并在请求超时后恢复检查', async () => {
    fetchVersion
      .mockImplementationOnce(
        (_, options) =>
          new Promise((_, reject) => {
            options?.signal?.addEventListener('abort', () => reject(options.signal?.reason))
          }),
      )
      .mockResolvedValueOnce(versionResponse('deployed'))
    mountChecker()
    await reconnect()
    expect(fetchVersion).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchVersion.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await reconnect()
    expect(notify).toHaveBeenCalledOnce()
  })

  it('部署恢复到当前页面的构建时关闭提示', async () => {
    fetchVersion
      .mockResolvedValueOnce(versionResponse('deployed'))
      .mockResolvedValueOnce(versionResponse('running'))
    mountChecker()
    await flushPromises()
    expect(notify).toHaveBeenCalledOnce()

    await reconnect()
    expect(closeNotification).toHaveBeenCalledOnce()
  })

  it('没有静态构建标识时跳过探测', async () => {
    vi.stubEnv('APP_BUILD_ID', '')
    mountChecker()
    await reconnect()
    await vi.advanceTimersByTimeAsync(5 * 60_000)

    expect(fetchVersion).not.toHaveBeenCalled()
  })
})
