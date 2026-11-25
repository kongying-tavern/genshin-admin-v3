<script lang="ts" setup>
import type { FeatureGroupOption } from './components'
import type { MapWindow, WindowContextHookReturnType } from '@/components'
import type { ManagerWindowOption } from './windowOptions'
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
import SiderMenuIcon from './components/SiderMenu/SiderMenuIcon.vue'
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
    icon: option.icon,
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
  preferenceStore.filterType = isAdvancedFilter.value ? 'basic' : 'advanced'
  preferenceStore.tabName = 'filter'
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
        <SiderMenuIcon name="filter" />
      </template>

      <template #action>
        <button
          class="sider-filter-mode"
          :class="{ 'is-advanced': isAdvancedFilter }"
          type="button"
          :aria-label="isAdvancedFilter ? 'Pro，切换到基础筛选' : 'Base，切换到高级筛选'"
          @click="switchFilterMode"
        >
          <span class="sider-icon-badge">{{ isAdvancedFilter ? 'Pro' : 'Base' }}</span>
        </button>
      </template>

      <MarkerFilter />
    </SiderMenuItem>

    <SiderMenuItem name="marker-table" label="点位列表">
      <template #icon>
        <SiderMenuIcon name="markers" />
        <span
          v-show="
            mapStateStore.markersFilterLoading || mapStateStore.currentLayerMarkers.length > 0
          "
          class="sider-icon-badge sider-icon-count"
        >
          {{ mapStateStore.currentLayerMarkers.length || '…' }}
        </span>
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

      <SiderMenuItem v-if="accessStore.get('MANAGER_COMPONENT')" name="features" label="系统管理">
        <template #icon>
          <SiderMenuIcon name="management" />
        </template>
        <FeatureGrid :features="featuresWithRole" />
      </SiderMenuItem>

      <SiderMenuItem label="公告" :icon="IconNotice" @click="noticeStore.show">
        <template #icon="{ color }">
          <el-icon :color="color" :size="38">
            <IconNotice />
          </el-icon>

          <div
            v-if="noticeStore.newCount > 0"
            class="absolute top-0 right-0 h-[18px] w-[18px] rounded-full grid place-content-center text-xs text-white bg-[#E6455F] font-genshin"
          >
            {{ noticeStore.newCount }}
          </div>
        </template>
      </SiderMenuItem>

      <SiderMenuItem v-if="manualWindow.enabled()" label="用户手册" @click="toggleManual">
        <template #icon>
          <SiderMenuIcon name="manual" :class="{ 'sider-icon-manual-open': isManualOpen }" />
        </template>
      </SiderMenuItem>

      <SiderMenuItem label="系统设置" @click="openSettingDialog">
        <template #icon>
          <SiderMenuIcon name="settings" />
        </template>
      </SiderMenuItem>
    </template>
  </SiderMenu>
</template>

<style scoped>
.sider-icon-badge {
  min-width: 16px;
  padding: 0 5px;
  border: 1px solid #a9d6c0;
  border-radius: 999px;
  background: #305e50;
  color: #fffaf0;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 12px;
  text-align: center;
  white-space: nowrap;
  user-select: none;
}

.sider-filter-mode {
  display: grid;
  width: 100%;
  min-height: 44px;
  place-items: center;
  border-radius: 12px;
  cursor: pointer;
  touch-action: manipulation;

  .sider-icon-badge {
    min-width: 44px;
    padding: 2px 6px;
    font-size: 12px;
    line-height: 16px;
  }

  &.is-advanced .sider-icon-badge {
    border-color: #d9c3ef;
    background: #5d4777;
  }

  &:hover .sider-icon-badge {
    border-color: #fffaf0;
  }

  &:focus-visible {
    outline: 2px solid #7ff5fe;
  }
}

.sider-icon-count {
  position: absolute;
  bottom: -2px;
  left: 50%;
  padding-inline: 3px;
  font-family: Arial, sans-serif;
  translate: -50% 0;
  pointer-events: none;
}

.sider-icon-manual-open {
  --icon-color: var(--sider-icon-accent);
}
</style>
