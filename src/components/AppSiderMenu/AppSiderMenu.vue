<script lang="ts" setup>
import type { FeatureGroupOption } from './components'
import type { MapWindow, WindowContextHookReturnType } from '@/components'
import type { ACCESS_BINARY_MASK } from '@/stores'
import * as ElIcons from '@element-plus/icons-vue'
import {
  AppSettings,
  AppUserAvatar,
  AppUserInfo,
  AppWindowTeleporter,
  useAppWindow,
} from '@/components'
import { IconInvitation, IconNotice } from '@/components/AppIcons'
import { useGlobalDialog } from '@/hooks'
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

interface ManagerModuleOption {
  name: string
  hook: WindowContextHookReturnType
  icon: Component
  comp: Component
  role: keyof typeof ACCESS_BINARY_MASK
  cols?: number
}

const collapse = ref(true)

const accessStore = useAccessStore()
const mapStateStore = useMapStateStore()
const noticeStore = useNoticeStore()
const preferenceStore = usePreferenceStore()
const userStore = useUserStore()

const { DialogService } = useGlobalDialog()

const commonWindowOptions: Omit<MapWindow.WindowOpenParams, 'id' | 'name'> = {
  minWidth: 887,
  minHeight: 500,
  center: true,
  sizeState: 'maximize',
}

const WINDOW_LIST: ManagerModuleOption[] = [
  {
    name: '物品管理',
    hook: useAppWindow({ name: '物品管理', ...commonWindowOptions }),
    icon: ElIcons.Box,
    comp: defineAsyncComponent(() => import('@/pages/pageItemManager/ItemManager.vue')),
    role: 'MANAGER_COMPONENT',
  },
  {
    name: '地区管理',
    hook: useAppWindow({ name: '地区管理', ...commonWindowOptions }),
    icon: ElIcons.Coordinate,
    comp: defineAsyncComponent(() => import('@/pages/pageAreaManager/AreaManager.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    name: '点位管理',
    hook: useAppWindow({ name: '点位管理', ...commonWindowOptions }),
    icon: ElIcons.Location,
    comp: defineAsyncComponent(() => import('@/pages/pageMarkerManager/MarkerManager.vue')),
    role: 'MANAGER_COMPONENT',
  },
  {
    name: '类型管理',
    hook: useAppWindow({ name: '类型管理', ...commonWindowOptions }),
    icon: ElIcons.FolderOpened,
    comp: defineAsyncComponent(() => import('@/pages/pageTypeManager/TypeManager.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    name: '图标管理',
    hook: useAppWindow({ name: '图标管理', ...commonWindowOptions }),
    icon: ElIcons.Picture,
    comp: defineAsyncComponent(() => import('@/pages/pageIconManager/IconManager.vue')),
    role: 'MANAGER_COMPONENT',
  },
  {
    name: '公告管理',
    hook: useAppWindow({ name: '公告管理', ...commonWindowOptions }),
    icon: ElIcons.ChatLineRound,
    comp: defineAsyncComponent(() => import('@/pages/pageNoticeManager/PageNoticeManager.vue')),
    role: 'MANAGER_COMPONENT',
  },
  {
    name: '用户统计',
    hook: useAppWindow({ name: '用户统计', ...commonWindowOptions }),
    icon: ElIcons.Star,
    comp: defineAsyncComponent(() => import('@/pages/pageContribution/PageContribution.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    name: '用户管理',
    hook: useAppWindow({ name: '用户管理', ...commonWindowOptions }),
    icon: ElIcons.User,
    comp: defineAsyncComponent(() => import('@/pages/pageUserManager/UserManager.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    name: '用户邀请',
    hook: useAppWindow({ name: '用户邀请', ...commonWindowOptions }),
    icon: IconInvitation,
    comp: defineAsyncComponent(() => import('@/pages/invitationManager/InvitationManager.vue')),
    role: 'ADMIN_COMPONENT',
  },
  {
    name: '历史记录',
    hook: useAppWindow({ name: '历史记录', ...commonWindowOptions }),
    icon: ElIcons.Memo,
    comp: defineAsyncComponent(() => import('@/pages/pageHistory/PageHistory.vue')),
    role: 'MANAGER_COMPONENT',
  },
]

const FEATURE_OPTIONS: FeatureGroupOption[] = [
  {
    items: WINDOW_LIST.map(({ name, hook, ...args }) => ({
      label: name,
      cb: hook.open,
      hook,
      ...args,
    })),
  },
]

const openSettingDialog = () => {
  DialogService.open(AppSettings)
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
  if (!isLogin.value) return
  DialogService.open(AppUserInfo)
}

const ManualInfo = defineAsyncComponent(() => import('@/pages/document/PageDocument.vue'))
const {
  isOpen: isManulOpen,
  info: manualInfo,
  toggle: toggleManual,
} = useAppWindow({
  name: '用户手册',
  ...commonWindowOptions,
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
    <AppWindowTeleporter v-if="accessStore.get('NORMAL_COMPONENT')" :info="manualInfo">
      <ManualInfo />
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
              {{ mapStateStore.currentLayerMarkers.length }}
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

      <SiderMenuItem
        v-if="accessStore.get('NORMAL_COMPONENT')"
        label="用户手册"
        @click="toggleManual"
      >
        <template #icon="{ color }">
          <div class="w-full h-full">
            <el-icon :color="isManulOpen ? '#68B11E' : color" :size="38">
              <ElIcons.Reading />
            </el-icon>
          </div>
        </template>
      </SiderMenuItem>

      <SiderMenuItem label="系统设置" :icon="ElIcons.Setting" @click="openSettingDialog" />
    </template>
  </SiderMenu>
</template>
