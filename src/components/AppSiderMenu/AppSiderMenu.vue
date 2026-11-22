<script lang="ts" setup>
import type { FeatureGroupOption } from './components'
import type { MapWindow, WindowContextHookReturnType } from '@/components'
import type { ManagerWindowOption } from './windowOptions'
import * as ElIcons from '@element-plus/icons-vue'
import { registerCapability } from '@/ai/bindings'
import { fail } from '@/ai/errors'
import { AppUserAvatar, AppWindowTeleporter, useAppWindow } from '@/components'
import { IconNotice } from '@/components/AppIcons'
import { openSettingsDialog } from '@/components/AppSettings/open'
import { openUserInfoDialog } from '@/components/AppUserInfo/open'
import {
  useAccessStore,
  useMapStateStore,
  useNoticeStore,
  usePreferenceStore,
  useUserStore,
} from '@/stores'
import {
  CollapseButton,
  FeatureGrid,
  MarkerFilter,
  MarkerTable,
  SiderMenu,
  SiderMenuItem,
} from './components'
import { isSiderTabKey, SIDER_TAB_KEYS } from './tabKeys'
import { registerWindowCapability } from './windowCapabilities'
import { MANAGER_WINDOW_OPTIONS, USER_MANUAL_WINDOW } from './windowOptions'

const collapse = ref(true)

const accessStore = useAccessStore()
const mapStateStore = useMapStateStore()
const noticeStore = useNoticeStore()
const preferenceStore = usePreferenceStore()
const userStore = useUserStore()

const commonWindowOptions: Partial<MapWindow.WindowOpenParams> = {
  minWidth: 887,
  minHeight: 500,
  center: true,
  sizeState: 'maximize',
}

const createWindow = (option: ManagerWindowOption) => {
  const enabled = () => accessStore.get(option.role)
  const hook: WindowContextHookReturnType = useAppWindow({
    ...commonWindowOptions,
    key: option.key,
    name: option.name,
    enabled,
  })
  return { ...option, hook, enabled }
}

const WINDOW_LIST = MANAGER_WINDOW_OPTIONS.map(createWindow)
const manualWindow = createWindow(USER_MANUAL_WINDOW)

const FEATURE_OPTIONS: FeatureGroupOption[] = [
  {
    items: WINDOW_LIST.map(({ name, hook, ...args }) => ({
      label: name,
      cb: hook.show,
      hook,
      ...args,
    })),
  },
]

const openSettingDialog = () => {
  openSettingsDialog()
}

const featuresWithRole = computed(() =>
  FEATURE_OPTIONS.reduce((seed, featureGroup) => {
    const groupItems = featureGroup.items.filter(({ role }) => {
      if (!role) return true
      return accessStore.get(role)
    })
    if (groupItems.length > 0) seed.push({ label: featureGroup.label, items: groupItems })
    return seed
  }, [] as FeatureGroupOption[]),
)

/**
 * --------------------------------------------------
 * 过滤器相关
 * --------------------------------------------------
 */
const isAdvancedFilter = computed(() => preferenceStore.filterType === 'advanced')

const switchFilterMode = () => {
  if (isAdvancedFilter.value) preferenceStore.filterType = 'basic'
  else preferenceStore.filterType = 'advanced'
}

const isLogin = computed(() => {
  if (!userStore.auth.accessToken) return false
  return userStore.info !== undefined
})

watch(isLogin, login => {
  if (!login) preferenceStore.tabName = 'filter'
})

const handleAvatarClick = () => {
  if (!isLogin.value || !userStore.info) return
  openUserInfoDialog()
}

const { isOpen: isManualOpen, info: manualInfo, toggle: toggleManual } = manualWindow.hook

// ==================== AI 页面句柄 ====================
const unbindSurfaces: (() => void)[] = []

unbindSurfaces.push(
  registerCapability({
    id: 'siderMenu',
    kind: 'panel',
    title: '侧边栏',
    description: '侧边栏页签：filter（筛选）/ marker-table（点位列表）/ features（系统管理）',
    open: params => {
      const record = (params ?? {}) as { tab?: unknown; collapsed?: unknown }
      const tab = record.tab
      if (tab !== undefined) {
        if (!isSiderTabKey(tab)) {
          fail('E_INVALID_PARAMS', `不支持的侧边栏页签：${String(tab)}`, {
            details: { tabs: SIDER_TAB_KEYS },
          })
        }
        preferenceStore.tabName = tab
      }
      collapse.value = record.collapsed === true
      return { collapsed: collapse.value, tab: preferenceStore.tabName }
    },
    close: () => {
      collapse.value = true
    },
    getState: () => ({
      open: !collapse.value,
      collapsed: collapse.value,
      tab: preferenceStore.tabName,
      tabs: [...SIDER_TAB_KEYS],
      filterType: preferenceStore.filterType,
    }),
  }),
)

for (const appWindow of [...WINDOW_LIST, manualWindow]) {
  unbindSurfaces.push(registerWindowCapability(appWindow, appWindow.hook, appWindow.enabled))
}

onUnmounted(() => {
  unbindSurfaces.forEach(unbind => unbind())
})
</script>

<template>
  <CollapseButton v-model:collapse="collapse" />

  <SiderMenu v-model="preferenceStore.tabName" v-model:collapse="collapse">
    <template v-for="appWindow in WINDOW_LIST" :key="appWindow.name">
      <AppWindowTeleporter v-if="accessStore.get(appWindow.role)" :info="appWindow.hook.info.value">
        <component :is="appWindow.comp" />
      </AppWindowTeleporter>
    </template>
    <AppWindowTeleporter v-if="manualWindow.enabled()" :info="manualInfo">
      <component :is="USER_MANUAL_WINDOW.comp" />
    </AppWindowTeleporter>

    <SiderMenuItem name="filter" :label="isAdvancedFilter ? '高级筛选' : '基础筛选'">
      <template #icon>
        <div class="w-full h-full overflow-hidden select-none">
          <el-icon class="left-0 top-0" color="var(--icon-color)" :size="38">
            <ElIcons.Filter />
          </el-icon>

          <div
            class="absolute right-0 bottom-0 rounded-full px-1.5 py-0.2 align-middle leading-snug text-sm font-bold -translate-x-[-2px] -translate-y-[-2px] hover:outline hover:outline-2 hover:outline-gray-200 cursor-pointer"
            :class="[isAdvancedFilter ? 'bg-[#806BA7]' : 'bg-[#68B11E]']"
            @click="switchFilterMode()"
          >
            {{ isAdvancedFilter ? 'Pro' : 'Base' }}
          </div>
        </div>
      </template>

      <MarkerFilter />
    </SiderMenuItem>

    <SiderMenuItem name="marker-table" label="点位列表">
      <template #icon>
        <div class="w-full h-full overflow-hidden select-none">
          <el-icon class="left-0 top-0" color="var(--icon-color)" :size="38">
            <ElIcons.List />
          </el-icon>

          <div
            v-show="
              mapStateStore.markersFilterLoading || mapStateStore.currentLayerMarkers.length > 0
            "
            class="absolute left-1/2 bottom-1 -translate-x-1/2 w-fit h-5 min-w-[20px] rounded-full p-0.5 grid place-items-center bg-[#68B11E]"
          >
            <span class="text-xs leading-none px-0.5 text-white">
              {{ mapStateStore.currentLayerMarkers.length || '…' }}
            </span>
          </div>
        </div>
      </template>
      <MarkerTable />
    </SiderMenuItem>

    <template #footer>
      <SiderMenuItem
        :label="userStore.info ? '用户中心' : '登录'"
        style="--icon-padding: 2px"
        @click="handleAvatarClick"
      >
        <template #icon>
          <AppUserAvatar />
        </template>
      </SiderMenuItem>

      <SiderMenuItem
        v-if="accessStore.get('MANAGER_COMPONENT')"
        name="features"
        label="系统管理"
        :icon="ElIcons.Grid"
      >
        <FeatureGrid :features="featuresWithRole" />
      </SiderMenuItem>

      <SiderMenuItem label="公告" :icon="IconNotice" @click="noticeStore.show">
        <template #icon="{ color }">
          <el-icon :color="color" :size="38">
            <IconNotice />
          </el-icon>

          <div
            v-if="noticeStore.newCount > 0"
            class="absolute top-0 right-0 h-[18px] w-[18px] rounded-full grid place-content-center text-xs text-white bg-[#E6455F] font-[HYWenHei-85W]"
          >
            {{ noticeStore.newCount }}
          </div>
        </template>
      </SiderMenuItem>

      <SiderMenuItem v-if="manualWindow.enabled()" label="用户手册" @click="toggleManual">
        <template #icon="{ color }">
          <div class="w-full h-full">
            <el-icon :color="isManualOpen ? '#68B11E' : color" :size="38">
              <ElIcons.Reading />
            </el-icon>
          </div>
        </template>
      </SiderMenuItem>

      <SiderMenuItem label="系统设置" :icon="ElIcons.Setting" @click="openSettingDialog" />
    </template>
  </SiderMenu>
</template>
