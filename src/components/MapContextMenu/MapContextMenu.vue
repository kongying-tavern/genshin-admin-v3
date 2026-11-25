<script lang="ts" setup>
import { Close, Edit, LocationInformation, Plus, Setting } from '@element-plus/icons-vue'
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
  getMapCoordinate: (point: DTO.Coordinate2D) => DTO.Coordinate2D | undefined
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

const contextCoordinate = shallowRef<DTO.Coordinate2D>()
// 未锁定时记录视口像素，锁定时记录地图坐标。
const placementPoint = shallowRef<DTO.Coordinate2D>()
const lockedPlacementCoordinate = shallowRef<DTO.Coordinate2D>()
const trigger = useTemplateRef<HTMLButtonElement>('placementTrigger')
const contextPanel = useTemplateRef<HTMLElement>('contextPanel')
const viewportWidth = inject(mapContainerWidthKey, ref(0))
const viewportHeight = inject(mapContainerHeightKey, ref(0))
const { position: projectedPosition } = useMapProjection({
  coord: computed(() =>
    placing.value ? lockedPlacementCoordinate.value : contextCoordinate.value,
  ),
  noCovertCoord: true,
})
const { width: panelWidth, height: panelHeight } = useElementSize(
  contextPanel,
  { width: 208, height: 208 },
  { box: 'border-box' },
)

const constrainToViewport = ([x, y]: DTO.Coordinate2D): DTO.Coordinate2D => [
  Math.max(0, Math.min(x, viewportWidth.value)),
  Math.max(0, Math.min(y, viewportHeight.value)),
]

const placementScreenPoint = computed(() =>
  constrainToViewport(placementPoint.value ?? [viewportWidth.value / 2, viewportHeight.value / 2]),
)
const reticlePosition = computed(() =>
  placing.value && !lockedPlacementCoordinate.value
    ? placementScreenPoint.value
    : projectedPosition.value,
)
const reticleStyle = computed(() => {
  const [x, y] = reticlePosition.value
  return { left: `${x}px`, top: `${y}px` }
})

const showContextActions = computed(() => {
  if (!contextCoordinate.value) return false
  if (placing.value) return true
  const [x, y] = reticlePosition.value
  return x >= 0 && x <= viewportWidth.value && y >= 0 && y <= viewportHeight.value
})

const getPlacementCoordinate = () =>
  lockedPlacementCoordinate.value ?? props.getMapCoordinate(placementScreenPoint.value)

const minimapTarget = shallowRef<DTO.Coordinate2D>()
watch(
  [
    placing,
    showMinimap,
    placementScreenPoint,
    lockedPlacementCoordinate,
    () => mapViewState?.value.target,
    () => mapViewState?.value.zoom,
  ],
  ([active, visible]) => {
    minimapTarget.value = active && visible ? getPlacementCoordinate() : undefined
  },
  { flush: 'post', immediate: true },
)
const visibleMinimapTarget = computed(() =>
  placing.value && showMinimap.value ? minimapTarget.value : undefined,
)

const menuOffset = (point: number, size: number, extent: number) => {
  const gap = 44
  const margin = 10
  const before = point + gap + size > extent - margin
  const start = before ? point - gap - size : point + gap
  return {
    before,
    offset: Math.max(margin, Math.min(start, extent - size - margin)),
  }
}

const contextMenuPosition = computed(() => {
  // 锁定的瞄准环可随地图移出视口，操作菜单仍可在边缘使用。
  const [x, y] = constrainToViewport(reticlePosition.value)
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

let reticleDrag: { element: HTMLElement; pointerId: number; offset: DTO.Coordinate2D } | undefined

const startReticleDrag = (event: PointerEvent) => {
  if (!placing.value || preferenceStore.lockPlacementReticle) return
  if (reticleDrag || event.button !== 0 || !event.isPrimary) return
  const [x, y] = placementScreenPoint.value
  const element = event.currentTarget as HTMLElement
  event.preventDefault()
  element.setPointerCapture(event.pointerId)
  reticleDrag = {
    element,
    pointerId: event.pointerId,
    offset: [x - event.clientX, y - event.clientY],
  }
}

const moveReticle = (event: PointerEvent) => {
  if (reticleDrag?.pointerId !== event.pointerId) return
  const [offsetX, offsetY] = reticleDrag.offset
  placementPoint.value = constrainToViewport([event.clientX + offsetX, event.clientY + offsetY])
}

const releaseReticle = () => {
  if (!reticleDrag) return
  const { element, pointerId } = reticleDrag
  reticleDrag = undefined
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId)
}

const endReticleDrag = (event: PointerEvent) => {
  if (reticleDrag?.pointerId !== event.pointerId) return
  if (event.type === 'pointerup') moveReticle(event)
  releaseReticle()
}

onBeforeUnmount(releaseReticle)

watch(
  () => preferenceStore.lockPlacementReticle,
  locked => {
    if (!placing.value) return
    releaseReticle()
    if (locked) {
      lockedPlacementCoordinate.value = getPlacementCoordinate()
    } else if (lockedPlacementCoordinate.value) {
      placementPoint.value = constrainToViewport(projectedPosition.value)
      lockedPlacementCoordinate.value = undefined
    }
  },
  { flush: 'sync' },
)

const closeContextMenu = () => {
  contextCoordinate.value = undefined
}

const closeMenus = () => {
  releaseReticle()
  closeContextMenu()
  placementPoint.value = undefined
  lockedPlacementCoordinate.value = undefined
  placing.value = false
}

watch([blocked, () => tileStore.currentTileConfig, () => userStore.isLogin], closeMenus)
watch(canPlace, allowed => {
  if (!allowed && placing.value) closeMenus()
})

const beginPlacement = (point?: DTO.Coordinate2D) => {
  if (!canPlace.value) return
  releaseReticle()
  if (!point) closeContextMenu()
  placementPoint.value = point
  lockedPlacementCoordinate.value = preferenceStore.lockPlacementReticle
    ? (contextCoordinate.value ?? props.getMapCoordinate(placementScreenPoint.value))
    : undefined
  mapStateStore.interaction.clearFocus()
  mapStateStore.interaction.clearHover()
  placing.value = true
  mapCanvasRef.value?.focus({ preventScroll: true })
}

useSubscription(
  MapSubject.click.subscribe(({ info, event }) => {
    if (blocked.value) return closeMenus()
    const [x, y] = info.coordinate ?? []
    if (!event.rightButton || !Number.isFinite(x) || !Number.isFinite(y)) {
      if (!placing.value) closeContextMenu()
      return
    }
    contextCoordinate.value = [x, y]
    beginPlacement([info.x, info.y])
  }),
)

useSubscription(
  MapSubject.dragStart.subscribe(() => {
    if (!placing.value) closeContextMenu()
  }),
)

useEventListener(
  mapCanvasRef,
  'pointerdown',
  (event: PointerEvent) => {
    if (props.editingAreaTags && event.button === 0) closeContextMenu()
  },
  { capture: true },
)

const cancelPlacement = async () => {
  closeMenus()
  await nextTick()
  trigger.value?.focus({ preventScroll: true })
}

useEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented || blocked.value) return
  if (placing.value) {
    event.preventDefault()
    void cancelPlacement()
  } else if (contextCoordinate.value) {
    event.preventDefault()
    closeContextMenu()
    mapCanvasRef.value?.focus({ preventScroll: true })
  }
})

const confirmPlacement = () => {
  if (!placing.value || !canPlace.value) return
  const point = getPlacementCoordinate()
  if (!point) return
  try {
    const markingItem = itemStore.itemIdMap.get(preferenceStore.defaultMarkingItemId)
    openMarkerCreatorDialog(tileStore.toMarkerCoordinate(point), markingItem)
    closeMenus()
  } catch (error) {
    ElMessage.error({ message: error instanceof Error ? error.message : String(error) })
  }
}

const openSettingDialog = () => {
  openSettingsDialog()
  closeMenus()
}

const editAreaTags = () => {
  const point = placing.value ? getPlacementCoordinate() : contextCoordinate.value
  if (point) props.areaTagAction?.open(point)
  closeMenus()
}

const makeLeavingInert = (element: Element) => element.setAttribute('inert', '')
</script>

<template>
  <Transition name="reticle" @before-leave="makeLeavingInert">
    <span
      v-if="placing || showContextActions"
      class="placement-reticle"
      :class="{
        'draggable-reticle': placing && !preferenceStore.lockPlacementReticle,
        'locked-reticle': placing && preferenceStore.lockPlacementReticle,
      }"
      :style="reticleStyle"
      aria-hidden="true"
      @pointerdown.stop="startReticleDrag"
      @pointermove="moveReticle"
      @pointerup="endReticleDrag"
      @pointercancel="endReticleDrag"
      @lostpointercapture="endReticleDrag"
      @contextmenu.prevent
    >
      <span class="reticle-frame">
        <span class="reticle-ring" />
        <span class="reticle-axis" />
        <span class="reticle-axis reticle-axis-vertical" />
      </span>
      <span class="reticle-center" />
    </span>
  </Transition>

  <div v-if="canCreate && !editingAreaTags" class="placement-tools font-genshin">
    <Transition name="placement-trigger" @before-leave="makeLeavingInert">
      <button
        v-if="!placing"
        ref="placementTrigger"
        type="button"
        class="placement-trigger"
        :disabled="!canPlace"
        @click="beginPlacement()"
      >
        <el-icon aria-hidden="true"><LocationInformation /></el-icon>
        添加点位
      </button>
    </Transition>
  </div>

  <Transition name="placement-menu" @before-leave="makeLeavingInert">
    <div
      v-if="placing || showContextActions"
      ref="contextPanel"
      class="context-menu font-genshin"
      :style="contextMenuPosition"
      @contextmenu.prevent
    >
      <PlacementMinimap
        v-if="visibleMinimapTarget"
        v-model:heading="heading"
        :target="visibleMinimapTarget"
      />
      <div class="context-actions" role="group" :aria-label="placing ? '点位选址' : '地图操作'">
        <template v-if="placing">
          <button
            type="button"
            class="menu-step menu-button lock-switch"
            role="switch"
            :aria-checked="preferenceStore.lockPlacementReticle"
            title="将瞄准环锁定在地图坐标上"
            @click="preferenceStore.lockPlacementReticle = !preferenceStore.lockPlacementReticle"
          >
            锁定
            <span class="lock-switch-track" aria-hidden="true" />
          </button>
          <button type="button" class="menu-step menu-button primary" @click="confirmPlacement">
            <el-icon aria-hidden="true"><Plus /></el-icon>
            添加点位
          </button>
          <button type="button" class="menu-step menu-button" @click="cancelPlacement">
            <el-icon aria-hidden="true"><Close /></el-icon>
            退出创建模式
          </button>
        </template>
        <template v-if="showContextActions">
          <button type="button" class="menu-step menu-button" @click="openSettingDialog">
            <el-icon aria-hidden="true"><Setting /></el-icon>
            系统设置
          </button>
          <button
            v-if="isDev && areaTagAction && mapReady && tileStore.currentTileConfig"
            type="button"
            class="menu-step menu-button"
            @click="editAreaTags"
          >
            <el-icon aria-hidden="true"><Edit /></el-icon>
            {{ areaTagAction.label }}
          </button>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.placement-reticle {
  position: absolute;
  z-index: 7;
  display: grid;
  width: 78px;
  aspect-ratio: 1;
  place-items: center;
  translate: -50% -50%;
  pointer-events: none;
}

.draggable-reticle {
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}

.draggable-reticle:active {
  cursor: grabbing;
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

.locked-reticle .reticle-ring {
  border-color: #bcefe2;
}

.locked-reticle .reticle-ring::after {
  border-color: #bcefe2a6;
  border-radius: 50%;
}

.locked-reticle .reticle-center::before,
.locked-reticle .reticle-center::after {
  background: #d1fff0;
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
  --trigger-inset: max(14px, env(safe-area-inset-right, 0px));
  position: absolute;
  z-index: 9;
  top: max(14px, env(safe-area-inset-top, 0px));
  right: var(--trigger-inset);
}

.placement-trigger,
.context-actions {
  color: #f2e8d5;
  border: 1px solid #a99065;
  background: #212937f5;
  box-shadow:
    0 4px 16px #14192365,
    inset 0 0 0 2px #f8deb514;
  pointer-events: auto;
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

.placement-trigger-enter-active,
.placement-trigger-leave-active {
  transition:
    translate 230ms ease-out,
    opacity 200ms ease-out;
}

.placement-trigger-enter-from,
.placement-trigger-leave-to {
  translate: calc(100% + var(--trigger-inset)) 0;
  opacity: 0;
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
  padding: 8px;
  border-radius: 28px;
}

.context-menu .placement-minimap {
  --minimap-size: min(188px, 35vw, 40vh);
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

.lock-switch {
  justify-content: space-between;
  padding-inline: 14px;
}

.lock-switch-track {
  display: flex;
  width: 32px;
  height: 18px;
  align-items: center;
  padding: 2px;
  border: 1px solid #dcc8a080;
  border-radius: 9px;
  background: #141923;
}

.lock-switch-track::after {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #f2dfb9;
  content: '';
}

.lock-switch[aria-checked='true'] .lock-switch-track {
  justify-content: flex-end;
  border-color: #bcefe2;
  background: #3e655c;
}

.lock-switch[aria-checked='true'] .lock-switch-track::after {
  background: #d1fff0;
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

.menu-step:nth-child(n + 4) {
  --step: 3;
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
    --trigger-inset: max(12px, env(safe-area-inset-right, 0px));
    top: calc(max(12px, env(safe-area-inset-top, 0px)) + 40px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reticle-enter-active,
  .reticle-leave-active,
  .reticle-enter-active .reticle-frame,
  .placement-trigger-enter-active,
  .placement-trigger-leave-active,
  .placement-menu-enter-active,
  .placement-menu-leave-active,
  .placement-menu-enter-active .menu-step,
  .placement-menu-leave-active .menu-step {
    transition: none;
  }
}
</style>
