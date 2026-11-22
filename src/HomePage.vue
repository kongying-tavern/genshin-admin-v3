<script setup lang="ts">
import type { GenshinMap, GenshinMapViewState } from '@/packages/map'
import { useSubscription } from '@vueuse/rxjs'
import { TRANSITION_EVENTS } from 'deck.gl'
import { filter } from 'rxjs'
import {
  AppDevInfo,
  AppDialogProvider,
  AppLogin,
  AppNoticeProvider,
  AppSiderMenu,
  AppStateBar,
  AppWindowProvider,
  MapContextMenu,
  MapLinkPopover,
  MapMarkerMoveController,
  MapMarkerPopover,
  MapMarkerToggleController,
  MapMarkerTweakController,
} from '@/components'
import { bindMapContext } from '@/ai/bindings'
import { context as dialogContext } from '@/components/AppDialog/context'
import { noticeContext } from '@/components/AppNotice/context'
import { useAppWindow } from '@/components/AppWindow/hooks'
import {
  createWindowWorkspace,
  windowWorkspaceKey,
} from '@/components/AppWindow/hooks/windowWorkspace'
import { useMapLayers, useTheme } from '@/hooks'
import { EaseoutInterpolator, GenshinMapDeck, GSZoomController } from '@/packages/map'
import {
  mapAffixKey,
  mapCanvasRef,
  mapContainerHeightKey,
  mapContainerKey,
  mapContainerWidthKey,
  MapSubject,
  mapViewStateKey,
} from '@/shared'
import {
  useAccessStore,
  useArchiveStore,
  useItemStore,
  useMarkerStore,
  useMapStateStore,
  useShortcutStore,
  useTileStore,
  useUserStore,
} from '@/stores'
import { useMapEntitySync } from '@/stores/mapEntitySync'

// ================ 全局状态 ================
const tileStore = useTileStore()
const userStore = useUserStore()
const accessStore = useAccessStore()
const archiveStore = useArchiveStore()
const shortcutStore = useShortcutStore()
const mapStateStore = useMapStateStore()
const entitySync = useMapEntitySync()
const markerStore = useMarkerStore()
const itemStore = useItemStore()
const mapDataStatus = computed(() => {
  if (!userStore.isLogin) return ''
  if (!entitySync.online) return '地图数据离线'
  if (markerStore.managerError || itemStore.managerError || entitySync.error)
    return '地图数据同步失败'
  if (!markerStore.syncState?.baseline || !itemStore.syncState?.baseline) return '正在加载地图数据'
  if (markerStore.updateLoading || itemStore.updateLoading) return '正在核对地图数据'
  return ''
})

// ================ 地图状态 ================
const genshinDeck = shallowRef<GenshinMap | null>(null)
const isPlacingMarker = ref(false)

const getMapCenter = (): DTO.Coordinate2D | undefined => {
  const viewport = genshinDeck.value?.getViewports()[0]
  if (!viewport) return
  const [x, y] = viewport.unproject([viewport.width / 2, viewport.height / 2])
  return [x, y]
}

const mapAffixRef = shallowRef<HTMLDivElement>()
const containerRef = shallowRef<HTMLDivElement>()
const { width, height } = useElementSize(containerRef)

const windows = useAppWindow()
const loginModal = ref(!userStore.isLogin)
watch(
  () => userStore.isLogin,
  isLogin => {
    if (!isLogin) loginModal.value = true
  },
  { flush: 'sync' },
)
const isModal = computed(
  () => loginModal.value || Boolean(dialogContext.current.value) || noticeContext.visible.value,
)
const workspace = createWindowWorkspace(
  windows,
  () => isModal.value,
  () => mapCanvasRef.value?.focus({ preventScroll: true }),
  () => containerRef.value,
)
provide(windowWorkspaceKey, workspace)
userStore.onBeforeLogout(() => {
  noticeContext.close()
  dialogContext.clear()
})

const focusMap = (event: FocusEvent) => {
  if (!isModal.value) windows.deactivate()
  MapSubject.focus.next(event)
}

const pressMap = () => {
  if (!isModal.value) windows.deactivate()
}

// 响应主题色切换
const { toggle: toggleDarkMode } = useTheme()
shortcutStore.useKeys(
  computed(() => archiveStore.preference['app.shortcutKey.toggleDarkMode']),
  () => {
    if (!isModal.value) toggleDarkMode()
  },
)

// ================ 视口状态 ================
const TRANSITION_DURATION = 150

/**
 * 基于 `Deck.setProps` 实现，因此
 * 必须通过整体赋值的方式来设置视口状态。
 * ```
 * // Good √
 * viewState.value = { ...viewState.value, zoom: -1 }
 * // Bad ×
 * viewState.value.zoom = -1
 * ```
 */
const viewState: Ref<GenshinMapViewState> = ref({
  zoom: -1,
  minZoom: -4,
  maxZoom: 4,
  target: [328, 6660],
  transitionDuration: TRANSITION_DURATION,
  transitionEasing: t => t,
  transitionInterruption: TRANSITION_EVENTS.BREAK,
})

// 暴露给 AI 页面句柄读取视口与容器尺寸
const unbindMapContext = bindMapContext({
  getViewState: () => ({
    zoom: viewState.value.zoom,
    minZoom: viewState.value.minZoom,
    maxZoom: viewState.value.maxZoom,
    target: [...viewState.value.target],
    transitionDuration: viewState.value.transitionDuration,
  }),
  getContainerSize: () => ({ width: width.value, height: height.value }),
})

onUnmounted(unbindMapContext)

// 将 viewState 变更事件响应到绑定对象上
useSubscription(
  MapSubject.viewState.subscribe(newViewState => {
    viewState.value = {
      ...viewState.value,
      ...newViewState,
    }
  }),
)

// 切换地区时，使用地区配置的初始视口状态
watch(
  () => tileStore.currentTileConfig,
  currentTileConfig => {
    if (!currentTileConfig) return
    const {
      target: [x, y],
      zoom,
    } = currentTileConfig.initViewState
    const [ox, oy] = currentTileConfig.tile.center
    viewState.value = {
      ...viewState.value,
      target: [x + ox, y + oy],
      zoom,
      transitionDuration: 1000,
      transitionInterpolator: new EaseoutInterpolator(['target', 'zoom']),
    }
  },
  { immediate: true },
)

// ================ 地图管理 ================
// 地图 focus 清理
useSubscription(
  MapSubject.click
    .pipe(filter(({ info }) => !info.layer))
    .subscribe(() => mapStateStore.interaction.clearFocus()),
)

// 地图 hover 清理
useSubscription(
  MapSubject.hover
    .pipe(filter(({ info }) => !info.layer))
    .subscribe(() => mapStateStore.interaction.clearHover()),
)

// ================ 图层管理 ================
const { layers } = useMapLayers()

// ================ 依赖注入 ================
provide(mapContainerKey, containerRef)
provide(mapContainerHeightKey, height)
provide(mapContainerWidthKey, width)
provide(mapAffixKey, mapAffixRef)
provide(mapViewStateKey, viewState)

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const { pathMatch } = route.params
  if (pathMatch) router.replace('/')
})
</script>

<template>
  <div ref="containerRef" class="w-full h-full overflow-hidden relative">
    <div class="map-workspace" :inert="isModal || undefined">
      <GenshinMapDeck
        v-model:canvas-ref="mapCanvasRef"
        v-model:view-state="viewState"
        :layers="layers"
        :disable-view-state-change="mapStateStore.isViewPortLocked"
        :cursor="mapStateStore.cursor"
        class="bg-black"
        tabindex="0"
        aria-label="地图"
        @pointerdown="pressMap"
        @focus="focusMap"
        @blur="event => MapSubject.blur.next(event)"
        @load="instance => (genshinDeck = instance)"
        @click="(info, event) => !isPlacingMarker && MapSubject.click.next({ info, event })"
        @hover="(info, event) => !isPlacingMarker && MapSubject.hover.next({ info, event })"
        @drag="(info, event) => MapSubject.drag.next({ info, event })"
        @drag-end="(info, event) => MapSubject.dragEnd.next({ info, event })"
        @drag-start="(info, event) => MapSubject.dragStart.next({ info, event })"
      />

      <div ref="mapAffixRef" class="affix-layer">
        <MapMarkerPopover />
        <MapLinkPopover v-if="accessStore.get('MANAGER_COMPONENT')" />
        <MapContextMenu
          v-model:placing="isPlacingMarker"
          :modal-open="isModal"
          :map-ready="Boolean(genshinDeck)"
          :get-map-center="getMapCenter"
        />
      </div>

      <GSZoomController v-model="viewState" :transition-duration="TRANSITION_DURATION" />
      <MapMarkerMoveController />
      <MapMarkerToggleController />
      <MapMarkerTweakController />

      <AppStateBar />
      <div
        v-if="mapDataStatus"
        class="absolute top-3 left-1/2 -translate-x-1/2 rounded px-3 py-1 text-sm bg-[var(--el-bg-color-overlay)] text-[var(--el-text-color-regular)]"
        role="status"
      >
        {{ mapDataStatus }}
      </div>
      <AppDevInfo />
      <AppSiderMenu />
      <AppWindowProvider />
    </div>
    <AppNoticeProvider />
    <AppDialogProvider />

    <el-dialog
      :model-value="!userStore.isLogin"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      header-class="hidden"
      body-class="bg-transparent"
      style="--el-dialog-bg-color: transparent"
      append-to-body
      width="fit-content"
      @closed="loginModal = !userStore.isLogin"
    >
      <AppLogin />
    </el-dialog>
  </div>
</template>

<style scoped>
.map-workspace {
  position: absolute;
  inset: 0;
  isolation: isolate;
  --map-window-layer: 11;
}

.affix-layer {
  @apply absolute left-0 top-0 w-full h-full pointer-events-none;
}
</style>
