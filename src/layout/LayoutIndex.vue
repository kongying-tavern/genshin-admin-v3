<script lang="ts" setup>
import { AppBreadCrumb, AppLogo, AppNotice, AppUpdatePush, AppUserAvatar } from '@/components'
import { LayoutAside, LayoutHeader, LayoutPage } from '@/layout'
import { useAccessStore } from '@/stores'

import { CurrentTime, DarkModeSwitch, SettingButton } from './components'

const accessStore = useAccessStore()
</script>

<template>
  <div class="layout-contianer w-full h-full grid overflow-hidden">
    <LayoutAside>
      <template #header>
        <AppLogo />
      </template>
      <AppSidemenu />
    </LayoutAside>

    <LayoutHeader>
      <div class="h-full flex-1 flex items-center justify-between text-sm px-4 flex-wrap">
        <AppBreadCrumb class="flex-1" />

        <div class="flex-1 flex justify-end items-center gap-1">
          <CurrentTime />
          <AppUpdatePush v-if="accessStore.get('ADMIN_COMPONENT')" title="推送应用更新" />
          <AppNotice title="公告" />
          <SettingButton title="设置" />
          <DarkModeSwitch title="黑暗模式" />
          <AppUserAvatar />
        </div>
      </div>
    </LayoutHeader>

    <LayoutPage />
  </div>
</template>

<style lang="scss" scoped>
// TODO: 变量抽离
.layout-contianer {
  --c-aside-width: 160px;
  --c-aside-shadow: 0 2px 8px #1d23290d;
  --c-header-height: 60px;
  --c-header-shdow: 2px 0 8px #1d23290d;

  grid-template-columns: auto 1fr;
  grid-template-rows: auto 1fr;
}
</style>
