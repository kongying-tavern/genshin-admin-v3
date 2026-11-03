import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { createPinia } from 'pinia'
import { AppError } from '@/components'
import { createLogger, createPWA, customPaint, ElementIcons } from '@/plugin'
import { router } from '@/router'
import { useArchiveStore, useBroadcastStore, useDadianStore, useUserStore } from '@/stores'
import App from './App.vue'
import './style/app.scss'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

void (async () => {
  const container = '#app'

  try {
    const app = createApp(App)
    app
      .use(createPinia())
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
    app.mount(container)
  } catch (err) {
    const formatedError = err instanceof Error ? err : new Error(`${err}`)
    createApp(AppError, {
      error: formatedError,
    }).mount(container)
  }
})()
