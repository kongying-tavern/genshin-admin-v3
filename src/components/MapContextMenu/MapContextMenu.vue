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
const contextActions = useTemplateRef<HTMLElement>('contextActions')
const confirmButton = useTemplateRef<HTMLButtonElement>('confirmButton')
const viewportWidth = inject(mapContainerWidthKey, ref(0))
const viewportHeight = inject(mapContainerHeightKey, ref(0))
const { position: projectedPosition } = useMapProjection({
  coord: computed(() =>
    placing.value ? lockedPlacementCoordinate.value : contextCoordinate.value,
  ),
  noCovertCoord: true,
})
const initialMenuSize = { width: 208, height: 208 }
const { width: panelWidth, height: panelHeight } = useElementSize(contextPanel, initialMenuSize, {
  box: 'border-box',
})
const { height: actionsHeight } = useElementSize(contextActions, initialMenuSize, {
  box: 'border-box',
})

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

const reticleInViewport = computed(() => {
  const [x, y] = reticlePosition.value
  return x >= 0 && x <= viewportWidth.value && y >= 0 && y <= viewportHeight.value
})
const showContextActions = computed(
  () => Boolean(contextCoordinate.value) && (placing.value || reticleInViewport.value),
)

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

const menuGap = 44
const menuMargin = 10
const clampMenuOffset = (start: number, size: number, extent: number) =>
  Math.max(menuMargin, Math.min(start, extent - size - menuMargin))

const menuOffset = (point: number, size: number, extent: number, leadingSpace = 0) => {
  const spaceAfter = extent - point - menuMargin
  const spaceBefore = point - leadingSpace - menuMargin
  const before = spaceAfter < menuGap + size && (leadingSpace === 0 || spaceBefore > spaceAfter)
  const start = (before ? point - menuGap - size : point + menuGap) - leadingSpace
  const offset = clampMenuOffset(start, size + leadingSpace, extent)
  return { before, offset, fits: start === offset }
}

const contextMenuPosition = computed(() => {
  // 锁定的瞄准环可随地图移出视口，操作菜单仍可在边缘使用。
  const [x, y] = constrainToViewport(reticlePosition.value)
  const horizontal = menuOffset(x, panelWidth.value || initialMenuSize.width, viewportWidth.value)
  const buttonListHeight = actionsHeight.value || initialMenuSize.height
  const menuHeight = Math.max(panelHeight.value, buttonListHeight)
  const minimapOffset = menuHeight - buttonListHeight
  const vertical = menuOffset(y, buttonListHeight, viewportHeight.value, minimapOffset)
  // 菜单能完整放在瞄准环一侧时，以「添加点位」按钮的中心对齐瞄准环。
  const button = horizontal.fits ? confirmButton.value : null
  const buttonHeight = button?.offsetHeight ?? 0
  const top =
    button && buttonHeight
      ? clampMenuOffset(y - button.offsetTop - buttonHeight / 2, menuHeight, viewportHeight.value)
      : vertical.offset
  return {
    left: `${horizontal.offset}px`,
    top: `${top}px`,
    transformOrigin: `${horizontal.before ? 'right' : 'left'} ${vertical.before ? 'bottom' : 'top'}`,
    '--menu-shift-x': horizontal.before ? '8px' : '-8px',
    '--menu-shift-y': vertical.before ? '8px' : '-8px',
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
    <div
      v-if="placing || showContextActions"
      class="reticle-overlay"
      :style="{ '--reticle-x': reticleStyle.left, '--reticle-y': reticleStyle.top }"
      aria-hidden="true"
    >
      <span v-if="placing && reticleInViewport" class="reticle-guides" />
      <span
        class="placement-reticle"
        :class="{
          'draggable-reticle': placing && !preferenceStore.lockPlacementReticle,
          'locked-reticle': placing && preferenceStore.lockPlacementReticle,
        }"
        :style="reticleStyle"
        @pointerdown.stop="startReticleDrag"
        @pointermove="moveReticle"
        @pointerup="endReticleDrag"
        @pointercancel="endReticleDrag"
        @lostpointercapture="endReticleDrag"
        @contextmenu.prevent
      >
        <span class="reticle-ring" />
        <span class="reticle-axis" />
        <span class="reticle-axis reticle-axis-vertical" />
        <span class="reticle-center" />
      </span>
    </div>
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
      <div
        ref="contextActions"
        class="context-actions"
        role="group"
        :aria-label="placing ? '点位选址' : '地图操作'"
      >
        <template v-if="placing">
          <button
            ref="confirmButton"
            type="button"
            class="menu-step menu-button primary"
            @click="confirmPlacement"
          >
            <el-icon aria-hidden="true"><Plus /></el-icon>
            添加点位
          </button>
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
          <button type="button" class="menu-step menu-button warning" @click="cancelPlacement">
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
.reticle-overlay {
  --reticle-radius: 32px;
  --reticle-border-width: 2px;
  --reticle-square-offset: calc(var(--reticle-radius) + 4px);
  --reticle-line-color: #8c8c8cb3;
  position: absolute;
  z-index: 7;
  inset: 0;
  pointer-events: none;
}

.reticle-guides {
  position: absolute;
  inset: 0;
}

.reticle-guides::before,
.reticle-guides::after {
  position: absolute;
  content: '';
}

/* 延伸线从方块中心开始，方块遮住相接处的线段。 */
.reticle-guides::before {
  inset: var(--reticle-y) 0 auto;
  height: 1px;
  translate: 0 -50%;
  background: linear-gradient(
    to right,
    var(--reticle-line-color) calc(var(--reticle-x) - var(--reticle-square-offset)),
    transparent 0 calc(var(--reticle-x) + var(--reticle-square-offset)),
    var(--reticle-line-color) 0
  );
}

.reticle-guides::after {
  inset: 0 auto 0 var(--reticle-x);
  width: 1px;
  translate: -50% 0;
  background: linear-gradient(
    to bottom,
    var(--reticle-line-color) calc(var(--reticle-y) - var(--reticle-square-offset)),
    transparent 0 calc(var(--reticle-y) + var(--reticle-square-offset)),
    var(--reticle-line-color) 0
  );
}

.placement-reticle {
  position: absolute;
  display: grid;
  width: 84px;
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

.reticle-ring {
  position: absolute;
  box-sizing: border-box;
  width: calc(2 * var(--reticle-radius));
  aspect-ratio: 1;
  border: var(--reticle-border-width) solid var(--reticle-line-color);
  border-radius: 50%;
}

.reticle-axis {
  position: absolute;
  width: calc(2 * var(--reticle-square-offset));
}

.reticle-axis-vertical {
  rotate: 90deg;
}

.reticle-axis::before,
.reticle-axis::after {
  position: absolute;
  top: 50%;
  box-sizing: border-box;
  width: 6px;
  height: 6px;
  translate: -50% -50%;
  rotate: 45deg;
  border: 1px solid #fff1cf;
  background: #c89e64;
  content: '';
}

.reticle-axis::after {
  left: 100%;
}

.reticle-axis::before {
  left: 0;
}

.reticle-center {
  display: grid;
  width: calc(2 * (var(--reticle-radius) - var(--reticle-border-width) - 6px));
  aspect-ratio: 1;
  place-items: center;
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

.locked-reticle .reticle-center::before,
.locked-reticle .reticle-center::after {
  background: #d1fff0;
}

.reticle-enter-active {
  transition: opacity 230ms ease-out;
}

.reticle-leave-active {
  transition: opacity 140ms ease-in;
}

.reticle-enter-from,
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
  max-height: calc(100% - 20px);
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.context-actions {
  display: grid;
  width: 208px;
  max-width: 100%;
  gap: 8px;
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

.menu-button.warning {
  border-color: var(--el-color-warning, #e6a23c);
  background: #603c28;
  color: #ffd29b;
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

  .menu-button.warning:hover {
    border-color: #ffc578;
    background: #754b31;
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
