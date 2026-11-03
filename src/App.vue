<script setup lang="ts">
import type { LocationQueryValue } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AppLogin } from '@/components'
import { useGlobalDialog, useRoleWatch } from '@/hooks'
import { RouteQuery } from '@/shared'

const router = useRouter()

const { DialogService } = useGlobalDialog()

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
