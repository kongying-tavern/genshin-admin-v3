import type { NotificationHandle } from 'element-plus'
import { ElButton, ElNotification } from 'element-plus'

const CHECK_INTERVAL_MS = 5 * 60_000
const REQUEST_TIMEOUT_MS = 10_000

/** 探测当前站点部署的前端版本。 */
export const useAppVersionCheck = () => {
  const currentBuildId = import.meta.env.APP_BUILD_ID
  if (!currentBuildId) return

  const versionUrl = new URL(`${import.meta.env.BASE_URL}version.json`, document.baseURI)
  let lastSeenBuildId = currentBuildId
  let pending: AbortController | undefined
  let notification: NotificationHandle | undefined

  const check = async () => {
    if (pending || document.hidden || !navigator.onLine) return

    const request = new AbortController()
    pending = request
    const timeout = window.setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS)

    try {
      versionUrl.searchParams.set('t', String(Date.now()))
      const response = await fetch(versionUrl.href, { cache: 'no-store', signal: request.signal })
      if (!response.ok) return

      const manifest: unknown = await response.json()
      if (
        request.signal.aborted
        || !manifest
        || typeof manifest !== 'object'
        || !('buildId' in manifest)
        || typeof manifest.buildId !== 'string'
      ) {
        return
      }

      const buildId = manifest.buildId.trim()
      if (!buildId || buildId === lastSeenBuildId) return
      lastSeenBuildId = buildId

      if (buildId === currentBuildId) {
        notification?.close()
        notification = undefined
        return
      }

      if (notification) return
      const opened = ElNotification({
        title: '应用有新版本',
        type: 'info',
        duration: 0,
        message: () =>
          h('div', [
            h('p', '保存正在编辑的内容后，即可刷新页面使用新版本。'),
            h(
              ElButton,
              {
                class: 'mt-2',
                size: 'small',
                type: 'primary',
                onClick: () => window.location.reload(),
              },
              () => '立即刷新',
            ),
          ]),
        onClose: () => {
          if (notification === opened) notification = undefined
        },
      })
      notification = opened
    } catch {
      // 离线、超时或部署期间响应无效时，等待下次检查。
    } finally {
      window.clearTimeout(timeout)
      pending = undefined
    }
  }

  const { resume } = useIntervalFn(check, CHECK_INTERVAL_MS, {
    immediate: false,
    immediateCallback: true,
  })
  onMounted(resume)
  useEventListener(document, 'visibilitychange', check)
  useEventListener(window, 'online', check)
  useEventListener(window, 'pageshow', event => {
    if (event.persisted) void check()
  })
  onScopeDispose(() => {
    pending?.abort()
    notification?.close()
  })
}
