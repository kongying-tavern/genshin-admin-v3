import type { Plugin } from 'vue'

export const ElementIcons: Plugin = {
  install: async app => {
    const ElemenePlusIconsVue = await import('@element-plus/icons-vue')
    for (const [key, icon] of Object.entries(ElemenePlusIconsVue)) app.component(key, icon)
  },
}
