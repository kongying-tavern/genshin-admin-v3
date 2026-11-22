<script lang="ts" setup>
import { Check, Close, Edit, LocationInformation, Plus, Setting } from '@element-plus/icons-vue'
import { useSubscription } from '@vueuse/rxjs'
import { ElMessage } from 'element-plus'
import { openSettingsDialog } from '@/components/AppSettings/open'
import { openMarkerCreatorDialog } from '@/components/MarkerModifyer/actions'
import {
  mapCanvasRef,
  mapContainerHeightKey,
  mapContainerWidthKey,
  MapSubject,
  mapViewStateKey,
} from '@/shared'
import {
  useAccessStore,
  useItemStore,
  useMapStateStore,
  usePreferenceStore,
  useTileStore,
  useUserStore,
} from '@/stores'
import { useMapProjection } from '../MapAffix/hooks'
import PlacementMinimap from './PlacementMinimap.vue'

const props = defineProps<{
  modalOpen: boolean
  mapReady: boolean
  getMapCenter: () => DTO.Coordinate2D | undefined
  editingAreaTags?: boolean
  areaTagAction?: { label: string; open: (coordinate: DTO.Coordinate2D) => void }
}>()

const placing = defineModel<boolean>('placing', { required: true })
const isDev = import.meta.env.DEV
const accessStore = useAccessStore()
const mapStateStore = useMapStateStore()
const tileStore = useTileStore()
const itemStore = useItemStore()
const preferenceStore = usePreferenceStore()
const userStore = useUserStore()

const canCreate = computed(() => userStore.isLogin && accessStore.get('MARKER_CREATE'))
const blocked = computed(() => props.modalOpen || Boolean(mapStateStore.mission))
const canPlace = computed(
  () =>
    canCreate.value
    && !blocked.value
    && !props.editingAreaTags
    && props.mapReady
    && Boolean(tileStore.currentTileConfig),
)
const showMinimap = computed(() => canPlace.value && preferenceStore.showPlacementMinimap)
const mapViewState = inject(mapViewStateKey)
// 原图箭头朝西南偏西。在本次打点期间沿用上一次调好的朝向。
const heading = ref(252)

const coordinate = shallowRef<DTO.Coordinate2D>()
const trigger = useTemplateRef<HTMLButtonElement>('placementTrigger')
const contextPanel = useTemplateRef<HTMLElement>('contextPanel')
const viewportWidth = inject(mapContainerWidthKey, ref(0))
const viewportHeight = inject(mapContainerHeightKey, ref(0))
const { position } = useMapProjection({ coord: coordinate, noCovertCoord: true })
const { width: panelWidth, height: panelHeight } = useElementSize(
  contextPanel,
  { width: 208, height: 208 },
  { box: 'border-box' },
)

const showContextMenu = computed(() => {
  const [x, y] = position.value
  return (
    coordinate.value !== undefined
    && x >= 0
    && x <= viewportWidth.value
    && y >= 0
    && y <= viewportHeight.value
  )
})

const reticlePosition = computed(() =>
  placing.value ? undefined : { left: `${position.value[0]}px`, top: `${position.value[1]}px` },
)

const menuOffset = (point: number, size: number, extent: number) => {
  const gap = 32
  const margin = 10
  const before = point + gap + size > extent - margin
  const start = before ? point - gap - size : point + gap
  return {
    before,
    offset: Math.max(margin, Math.min(start, extent - size - margin)),
  }
}

const contextMenuPosition = computed(() => {
  const [x, y] = position.value
  const horizontal = menuOffset(x, panelWidth.value || 208, viewportWidth.value)
  const vertical = menuOffset(y, panelHeight.value || 208, viewportHeight.value)
  return {
    left: `${horizontal.offset}px`,
    top: `${vertical.offset}px`,
    transformOrigin: `${horizontal.before ? 'right' : 'left'} ${vertical.before ? 'bottom' : 'top'}`,
    '--menu-shift-x': horizontal.before ? '8px' : '-8px',
    '--menu-shift-y': vertical.before ? '8px' : '-8px',
    '--menu-direction': horizontal.before ? 'row-reverse' : 'row',
    '--menu-align': vertical.before ? 'flex-end' : 'flex-start',
  }
})

const closeContextMenu = () => {
  coordinate.value = undefined
}

const closeMenus = () => {
  closeContextMenu()
  placing.value = false
}

watch([blocked, () => tileStore.currentTileConfig, () => userStore.isLogin], closeMenus)
watch(canPlace, allowed => {
  if (!allowed) placing.value = false
})

useSubscription(
  MapSubject.click.subscribe(({ info, event }) => {
    if (placing.value || !event.rightButton || blocked.value) return closeContextMenu()
    const [x, y] = info.coordinate ?? []
    if (!Number.isFinite(x) || !Number.isFinite(y)) return closeContextMenu()
    coordinate.value = [x, y]
  }),
)

useSubscription(MapSubject.dragStart.subscribe(closeContextMenu))

useEventListener(
  mapCanvasRef,
  'pointerdown',
  (event: PointerEvent) => {
    if (props.editingAreaTags && event.button === 0) closeContextMenu()
  },
  { capture: true },
)

const beginPlacement = () => {
  if (!canPlace.value) return
  closeContextMenu()
  mapStateStore.interaction.clearFocus()
  mapStateStore.interaction.clearHover()
  placing.value = true
  mapCanvasRef.value?.focus({ preventScroll: true })
}

const cancelPlacement = async () => {
  placing.value = false
  await nextTick()
  trigger.value?.focus({ preventScroll: true })
}

useEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented || blocked.value) return
  if (placing.value) {
    event.preventDefault()
    void cancelPlacement()
  } else if (coordinate.value) {
    event.preventDefault()
    closeContextMenu()
    mapCanvasRef.value?.focus({ preventScroll: true })
  }
})

const openMarkerCreator = (point?: DTO.Coordinate2D) => {
  if (!point || !canCreate.value || blocked.value) return
  try {
    const markingItem = itemStore.itemIdMap.get(preferenceStore.defaultMarkingItemId)
    openMarkerCreatorDialog(tileStore.toMarkerCoordinate(point), markingItem)
    closeMenus()
  } catch (error) {
    ElMessage.error({ message: error instanceof Error ? error.message : String(error) })
  }
}

const confirmPlacement = () => {
  if (placing.value && canPlace.value) openMarkerCreator(props.getMapCenter())
}

const openSettingDialog = () => {
  openSettingsDialog()
  closeContextMenu()
}

const editAreaTags = (point: DTO.Coordinate2D) => {
  props.areaTagAction?.open(point)
  closeContextMenu()
}

const makeLeavingInert = (element: Element) => element.setAttribute('inert', '')
</script>

<template>
  <Transition name="reticle">
    <span
      v-if="placing || showContextMenu"
      :key="placing ? 'center' : 'context'"
      class="placement-reticle"
      :style="reticlePosition"
      aria-hidden="true"
    >
      <span class="reticle-frame">
        <span class="reticle-ring" />
        <span class="reticle-axis" />
        <span class="reticle-axis reticle-axis-vertical" />
      </span>
      <span class="reticle-center" />
    </span>
  </Transition>

  <PlacementMinimap
    v-if="placing && showMinimap && mapViewState"
    v-model:heading="heading"
    :target="mapViewState.target"
    class="center-minimap"
  />

  <div v-if="canCreate && !editingAreaTags" class="placement-tools">
    <button
      v-if="!placing"
      ref="placementTrigger"
      type="button"
      class="placement-trigger"
      :disabled="!canPlace"
      @click="beginPlacement"
    >
      <el-icon aria-hidden="true"><LocationInformation /></el-icon>
      添加点位
    </button>

    <Transition name="placement-menu" @before-leave="makeLeavingInert">
      <div v-if="placing" class="placement-panel" role="group" aria-label="点位选址">
        <p class="menu-step placement-hint" role="status">拖动或缩放地图，对准中心十字</p>
        <div class="placement-actions">
          <button type="button" class="menu-step menu-button" @click="cancelPlacement">
            <el-icon aria-hidden="true"><Close /></el-icon>
            取消
          </button>
          <button type="button" class="menu-step menu-button primary" @click="confirmPlacement">
            <el-icon aria-hidden="true"><Check /></el-icon>
            确认位置
          </button>
        </div>
      </div>
    </Transition>
  </div>

  <Transition name="placement-menu" @before-leave="makeLeavingInert">
    <div
      v-if="showContextMenu && coordinate"
      ref="contextPanel"
      class="context-menu"
      :style="contextMenuPosition"
      role="group"
      aria-label="地图操作"
      @contextmenu.prevent
    >
      <PlacementMinimap v-if="showMinimap" v-model:heading="heading" :target="coordinate" />
      <div class="context-actions">
        <button
          v-if="canCreate && !editingAreaTags"
          type="button"
          class="menu-step menu-button primary"
          @click="openMarkerCreator(coordinate)"
        >
          <el-icon aria-hidden="true"><Plus /></el-icon>
          添加点位
        </button>
        <button type="button" class="menu-step menu-button" @click="openSettingDialog">
          <el-icon aria-hidden="true"><Setting /></el-icon>
          系统设置
        </button>
        <button
          v-if="isDev && areaTagAction && mapReady && tileStore.currentTileConfig"
          type="button"
          class="menu-step menu-button"
          @click="editAreaTags(coordinate)"
        >
          <el-icon aria-hidden="true"><Edit /></el-icon>
          {{ areaTagAction.label }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.placement-reticle {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 7;
  display: grid;
  width: 78px;
  aspect-ratio: 1;
  place-items: center;
  translate: -50% -50%;
  pointer-events: none;
}

.reticle-frame {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: radial-gradient(circle, #17223222 10%, #17223292 49%, transparent 70%);
}

.reticle-ring {
  position: absolute;
  inset: 13px;
  border: 1px solid #ffe6b8;
  border-radius: 50%;
  box-shadow:
    0 0 0 1px #202839b0,
    0 0 14px #ffe0a035,
    inset 0 0 0 1px #202839b0;
}

.reticle-ring::before,
.reticle-ring::after {
  position: absolute;
  content: '';
}

.reticle-ring::before {
  inset: 4px;
  border: 1px solid #f3d7a875;
  border-radius: 50%;
}

.reticle-ring::after {
  inset: 7px;
  rotate: 45deg;
  border: 1px solid #f3d7a899;
  border-radius: 4px;
}

.reticle-axis {
  position: absolute;
  width: 68px;
  height: 1px;
  background: linear-gradient(to right, #f5d9a4 9px, transparent 9px calc(100% - 9px), #f5d9a4 0);
  filter: drop-shadow(0 0 1px #171e2b);
}

.reticle-axis-vertical {
  rotate: 90deg;
}

.reticle-axis::before,
.reticle-axis::after {
  position: absolute;
  top: 50%;
  width: 6px;
  height: 6px;
  translate: 0 -50%;
  rotate: 45deg;
  border: 1px solid #fff1cf;
  background: #c89e64;
  content: '';
}

.reticle-axis::after {
  right: 0;
}

.reticle-axis::before {
  left: 0;
}

.reticle-center {
  position: relative;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  filter: drop-shadow(0 0 1px #151d2a);
}

.reticle-center::before,
.reticle-center::after {
  width: 100%;
  height: 1px;
  grid-area: 1 / 1;
  background: #fff8df;
  content: '';
}

.reticle-center::after {
  rotate: 90deg;
}

.reticle-enter-active .reticle-frame {
  transition:
    scale 360ms cubic-bezier(0.18, 0.86, 0.32, 1),
    opacity 230ms ease-out;
}

.reticle-enter-active {
  transition: opacity 360ms ease-out;
}

.reticle-leave-active {
  transition: opacity 140ms ease-in;
}

.reticle-enter-from .reticle-frame {
  scale: 1.26;
  opacity: 0;
}

.reticle-leave-to {
  opacity: 0;
}

.placement-tools {
  position: absolute;
  z-index: 9;
  top: max(14px, env(safe-area-inset-top, 0px));
  right: max(14px, env(safe-area-inset-right, 0px));
}

.placement-trigger,
.placement-panel,
.context-actions {
  color: #f2e8d5;
  border: 1px solid #a99065;
  background: #212937f5;
  box-shadow:
    0 4px 16px #14192365,
    inset 0 0 0 2px #f8deb514;
  pointer-events: auto;
  font-family: 'HYWenHei-85W', system-ui, sans-serif;
}

.placement-trigger {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: 22px;
  font-size: 14px;
}

.placement-trigger .el-icon {
  color: #ffda96;
  font-size: 18px;
}

.placement-trigger:disabled {
  opacity: 0.54;
}

.placement-panel,
.context-actions {
  padding: 8px;
  border-radius: 28px;
}

.placement-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: min(230px, calc(100vw - 96px));
  transform-origin: top right;
}

.placement-hint {
  margin: 2px 4px 8px;
  color: #e6d6ba;
  font-size: 13px;
  line-height: 1.5;
}

.placement-actions {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 6px;
}

.context-menu {
  position: absolute;
  z-index: 10;
  display: flex;
  width: max-content;
  max-width: calc(100% - 20px);
  flex-direction: var(--menu-direction);
  align-items: var(--menu-align);
  gap: 8px;
}

.context-actions {
  display: grid;
  width: 208px;
  min-width: 0;
  max-height: calc(100dvh - 20px);
  gap: 5px;
  overflow-y: auto;
}

.context-menu .placement-minimap {
  --minimap-size: min(188px, 35vw, 40vh);
}

.center-minimap {
  position: absolute;
  z-index: 8;
  top: 50%;
  left: calc(50% + 48px);
  translate: 0 calc(var(--minimap-size) / -2);
}

@media (width <= 600px) and (orientation: portrait) {
  .center-minimap {
    --minimap-size: min(188px, 42vw, max(96px, calc(50dvh - 128px)));
    top: calc(50% + 48px);
    left: 50%;
    translate: -50% 0;
  }
}

@media (height <= 440px) and (orientation: landscape) {
  .center-minimap {
    right: calc(50% + 48px);
    left: auto;
  }
}

.menu-button {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 8px;
  border: 1px solid #dcc8a04d;
  border-radius: 22px;
  background: #fbedd012;
  color: #f2e8d5;
  font-size: 14px;
  white-space: nowrap;
}

.menu-button:not(:disabled),
.placement-trigger:not(:disabled) {
  cursor: pointer;
}

.menu-button.primary {
  border-color: #f8e0b2;
  background: #f2dfb9;
  color: #343044;
}

.menu-button:focus-visible,
.placement-trigger:focus-visible {
  outline: 2px solid #ffe2a5;
  outline-offset: 2px;
}

@media (hover: hover) {
  .menu-button:hover,
  .placement-trigger:not(:disabled):hover {
    background: #3a4352;
    border-color: #ffe2a5;
  }

  .menu-button.primary:hover {
    background: #fff0cd;
  }
}

.placement-menu-enter-active {
  transition:
    opacity 175ms ease-out,
    transform 350ms cubic-bezier(0.18, 0.86, 0.32, 1);
}

.placement-menu-leave-active {
  transition:
    opacity 155ms ease-in 50ms,
    transform 205ms ease-in;
  pointer-events: none;
}

.placement-menu-enter-from,
.placement-menu-leave-to {
  opacity: 0;
  transform: translate(var(--menu-shift-x, 0), var(--menu-shift-y, -8px)) scale(0.96);
}

.menu-step:nth-child(2) {
  --step: 1;
}

.menu-step:nth-child(3) {
  --step: 2;
}

.menu-step:nth-child(4) {
  --step: 3;
}

.placement-actions .menu-step {
  --step: 1;
}

.placement-actions .menu-step + .menu-step {
  --step: 2;
}

.placement-menu-enter-active .menu-step {
  transition:
    opacity 160ms ease-out,
    translate 220ms cubic-bezier(0.18, 0.86, 0.32, 1);
  transition-delay: calc(30ms + var(--step, 0) * 32ms);
}

.placement-menu-leave-active .menu-step {
  transition:
    opacity 110ms ease-in,
    translate 160ms ease-in;
  transition-delay: calc((3 - var(--step, 0)) * 12ms);
}

.placement-menu-enter-from .menu-step,
.placement-menu-leave-to .menu-step {
  translate: 0 -5px;
  opacity: 0;
}

@media (width <= 600px) {
  .placement-tools {
    top: calc(max(12px, env(safe-area-inset-top, 0px)) + 40px);
    right: max(12px, env(safe-area-inset-right, 0px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .reticle-enter-active,
  .reticle-leave-active,
  .reticle-enter-active .reticle-frame,
  .placement-menu-enter-active,
  .placement-menu-leave-active,
  .placement-menu-enter-active .menu-step,
  .placement-menu-leave-active .menu-step {
    transition: none;
  }
}
</style>
