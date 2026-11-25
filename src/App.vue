<script setup lang="ts">
import type { LocationQueryValue } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AppLogin } from '@/components'
import { useGlobalDialog, useRoleWatch } from '@/hooks'
import { RouteQuery } from '@/shared'
import { useDadianStore } from '@/stores/dadian'
import { usePreferenceStore } from '@/stores/userPreference'

const router = useRouter()

const { DialogService } = useGlobalDialog()

const dadianStore = useDadianStore()
const preferenceStore = usePreferenceStore()

// 写入根元素，使传送到 body 的弹窗和下拉面板也能继承字体设置。
const setFont = (
  property: string,
  family: string,
  fallback = 'ui-sans-serif, system-ui, sans-serif',
) => {
  const font = dadianStore.loadedFontFamilies.get(family)
  document.documentElement.style.setProperty(property, font ? `${font}, ${fallback}` : '')
}

watchEffect(() => {
  setFont('--app-font-genshin', preferenceStore.genshinFont)
  setFont('--app-font-element', preferenceStore.elementFont)
  setFont('--app-font-marker-description', preferenceStore.markerDescriptionFont)
  setFont('--app-font-notice-editor', preferenceStore.noticeEditorFont, 'sans-serif')
})

// 启动角色轮询监听（5min 轮询 + visibilitychange）
useRoleWatch()

const queryHandlers = new Map<
  string,
  (value: LocationQueryValue | LocationQueryValue[]) => void | Promise<void>
>([
  [
    RouteQuery.Invitation.getKey(),
    value => {
      try {
        if (Array.isArray(value)) throw new Error('存在多重邀请码参数')
        if (!value) throw new Error('邀请码参数为空')
        const { code, username } = RouteQuery.Invitation.parse(value)
        DialogService.props({
          code,
          username,
          isRegisterMode: true,
        }).open(AppLogin)
      } catch (err) {
        ElMessage.error(`邀请码解析失败，原因为：${err instanceof Error ? err.message : err}`)
      }
    },
  ],
])

onMounted(async () => {
  await nextTick()
  const query = structuredClone(router.currentRoute.value.query)
  await router.replace(router.currentRoute.value.path)
  await Promise.allSettled(
    Object.entries(query).map(async ([key, value]) => {
      const handler = queryHandlers.get(key)
      if (!handler) return
      await handler(value)
    }),
  )
})
</script>

<template>
  <router-view />
</template>
