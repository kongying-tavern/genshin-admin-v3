import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { createPinia } from 'pinia'
import { resolveBridgeMode } from '@/ai/mode'
import Apis from '@/api/alova'
import { AppError } from '@/components'
import { createLogger, createPWA, customPaint, ElementIcons } from '@/plugin'
import { router } from '@/router'
import { useArchiveStore, useBroadcastStore, useDadianStore, useUserStore } from '@/stores'
import { startMapEntitySync } from '@/stores/mapEntitySync/start'
import App from './App.vue'
// 与迁移前 Tailwind 的样式顺序保持一致：preflight/reset、工具类、主题覆盖
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import './style/app.scss'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

// 部分模块（如 stores/user.ts）直接引用全局 Apis，需在应用启动前挂载
Reflect.set(globalThis, 'Apis', Apis)

// 必须在 router / App.vue 清理 query 之前解析 AI 页面句柄模式
const bridgeMode = resolveBridgeMode()
if (bridgeMode.mode !== 'off') {
  document.documentElement.dataset.aiBridge = 'booting'
}

void (async () => {
  const container = '#app'

  try {
    const pinia = createPinia()
    const app = createApp(App)
    app
      .use(pinia)
      .use(createPWA())
      .use(createLogger())
      .use(customPaint())
      .use(ElementPlus, {
        locale: zhCn,
      })
      .use(ElementIcons)
      .use(router)
    useBroadcastStore().init()
    await useUserStore().init()
    await useDadianStore().init()
    await useArchiveStore().init()
    app.runWithContext(startMapEntitySync)
    app.mount(container)

    if (bridgeMode.mode !== 'off') {
      void import('@/ai/install')
        .then(({ installAiBridge }) =>
          installAiBridge({
            mode: bridgeMode.mode as 'read' | 'write',
            source: bridgeMode.source,
            pinia,
          }),
        )
        .catch(err => {
          console.error('[AI] 页面句柄安装失败', err)
          document.documentElement.dataset.aiBridge = 'error'
        })
    }
  } catch (err) {
    if (bridgeMode.mode !== 'off') {
      document.documentElement.dataset.aiBridge = 'error'
    }
    const formatedError = err instanceof Error ? err : new Error(`${err}`)
    createApp(AppError, {
      error: formatedError,
    }).mount(container)
  }
})()
