<script lang="ts" setup>
import type { PlacementAxis } from './placementGeometry'
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
import { directionBadgeSize, getPlacementDirection } from './placementGeometry'
import PlacementGuides from './PlacementGuides.vue'
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
const placementPoint = shallowRef<{ position: DTO.Coordinate2D; fromViewportSnapshot?: true }>()
const lockedPlacementCoordinate = shallowRef<DTO.Coordinate2D>()
const recenterPoint = shallowRef<DTO.Coordinate2D>()
const recentering = computed(() => recenterPoint.value !== undefined)
const recenterDuration = 300
let recenterFrame: number | undefined
const trigger = useTemplateRef<HTMLButtonElement>('placementTrigger')
const contextPanel = useTemplateRef<HTMLElement>('contextPanel')
const contextActions = useTemplateRef<HTMLElement>('contextActions')
const confirmButton = useTemplateRef<HTMLButtonElement>('confirmButton')
const viewportWidth = inject(mapContainerWidthKey, ref(0))
const viewportHeight = inject(mapContainerHeightKey, ref(0))
const viewport = computed<DTO.Coordinate2D>(() => [viewportWidth.value, viewportHeight.value])
const viewportCenter = computed<DTO.Coordinate2D>(() => [
  viewportWidth.value / 2,
  viewportHeight.value / 2,
])
const { position: projectedPosition, scaleRatio } = useMapProjection({
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

const placementScreenPoint = computed(() => {
  if (recenterPoint.value) return recenterPoint.value
  const point = placementPoint.value
  if (!point) return viewportCenter.value
  return point.fromViewportSnapshot ? point.position : constrainToViewport(point.position)
})
const reticlePosition = computed(() =>
  placing.value && (recentering.value || !lockedPlacementCoordinate.value)
    ? placementScreenPoint.value
    : projectedPosition.value,
)
const reticleStyle = computed(() => {
  const [x, y] = reticlePosition.value
  return { left: `${x}px`, top: `${y}px` }
})
const reticleRadius = computed(() => (placing.value ? 48 : 32))
const reticleSquareOffset = computed(() => reticleRadius.value + 4)
const reticleDimensions = computed(() => ({
  '--reticle-radius': `${reticleRadius.value}px`,
  '--reticle-square-offset': `${reticleSquareOffset.value}px`,
}))

const visibleGuideAxes = computed(() => {
  const [x, y] = reticlePosition.value
  return [x >= 0 && x <= viewportWidth.value, y >= 0 && y <= viewportHeight.value] as const
})
const showContextActions = computed(
  () =>
    Boolean(contextCoordinate.value) && (placing.value || visibleGuideAxes.value.every(Boolean)),
)
const placementDirection = computed(() =>
  placing.value && lockedPlacementCoordinate.value
    ? getPlacementDirection(reticlePosition.value, viewport.value)
    : undefined,
)
const directionLabels = { left: '左侧', right: '右侧', top: '上方', bottom: '下方' }

const getPlacementCoordinate = () =>
  (recentering.value ? undefined : lockedPlacementCoordinate.value)
  ?? props.getMapCoordinate(placementScreenPoint.value)

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

const menuMargin = 10
const directionMenuGap = directionBadgeSize / 2 + 10
const clampMenuOffset = (start: number, size: number, extent: number) =>
  Math.max(menuMargin, Math.min(start, extent - size - menuMargin))

const menuOffset = (point: number, size: number, extent: number, leadingSpace = 0) => {
  const menuGap = reticleSquareOffset.value + 8
  const spaceAfter = extent - point - menuMargin
  const spaceBefore = point - leadingSpace - menuMargin
  const before = spaceAfter < menuGap + size && (leadingSpace === 0 || spaceBefore > spaceAfter)
  const start = (before ? point - menuGap - size : point + menuGap) - leadingSpace
  const offset = clampMenuOffset(start, size + leadingSpace, extent)
  return { before, offset, fits: start === offset }
}

const contextMenuPosition = computed(() => {
  const [width, height] = viewport.value
  const menuWidth = panelWidth.value || initialMenuSize.width
  const buttonListHeight = actionsHeight.value || initialMenuSize.height
  const menuHeight = Math.max(panelHeight.value, buttonListHeight)

  const direction = placementDirection.value
  if (direction) {
    const { x, y, edge } = direction
    const stacked = edge === 'top' || edge === 'bottom'
    const leading = edge === 'top' || edge === 'left'
    const anchor = stacked ? y : x
    const extent = stacked ? height : width
    const available = (leading ? extent - anchor : anchor) - directionMenuGap - menuMargin
    const maxWidth = Math.max(0, stacked ? width - 2 * menuMargin : available)
    const maxHeight = Math.max(0, stacked ? available : height - 2 * menuMargin)
    const fittedWidth = Math.min(menuWidth, maxWidth)
    const fittedHeight = Math.min(menuHeight, maxHeight)
    const adjacent = leading
      ? anchor + directionMenuGap
      : anchor - directionMenuGap - (stacked ? fittedHeight : fittedWidth)

    return {
      left: `${stacked ? clampMenuOffset(x - fittedWidth / 2, fittedWidth, width) : adjacent}px`,
      top: `${stacked ? adjacent : clampMenuOffset(y - fittedHeight / 2, fittedHeight, height)}px`,
      '--menu-max-width': `${maxWidth}px`,
      '--menu-max-height': `${maxHeight}px`,
    }
  }

  const [x, y] = constrainToViewport(reticlePosition.value)
  const horizontal = menuOffset(x, menuWidth, width)
  const minimapOffset = menuHeight - buttonListHeight
  const vertical = menuOffset(y, buttonListHeight, height, minimapOffset)
  // 菜单能完整放在瞄准环一侧时，以「添加点位」按钮的中心对齐瞄准环。
  const button = horizontal.fits ? confirmButton.value : null
  const buttonHeight = button?.offsetHeight ?? 0
  const top =
    button && buttonHeight
      ? clampMenuOffset(y - button.offsetTop - buttonHeight / 2, menuHeight, height)
      : vertical.offset
  return {
    left: `${horizontal.offset}px`,
    top: `${top}px`,
    transformOrigin: `${horizontal.before ? 'right' : 'left'} ${vertical.before ? 'bottom' : 'top'}`,
    '--menu-shift-x': horizontal.before ? '8px' : '-8px',
    '--menu-shift-y': vertical.before ? '8px' : '-8px',
  }
})

type ReticleDrag = { element: HTMLElement; pointerId: number } & (
  | { axis?: undefined; offset: DTO.Coordinate2D }
  | { axis: PlacementAxis; lastClientPosition: number }
)
const reticleDrag = shallowRef<ReticleDrag>()

const startReticleDrag = (event: PointerEvent, axis?: PlacementAxis) => {
  if (
    !placing.value
    || !canPlace.value
    || recentering.value
    || reticleDrag.value
    || event.button !== 0
    || !event.isPrimary
  )
    return
  if (axis === undefined ? preferenceStore.lockPlacementReticle : !visibleGuideAxes.value[axis])
    return

  const { clientX, clientY, pointerId } = event
  const element = event.currentTarget as HTMLElement
  event.preventDefault()
  element.setPointerCapture(pointerId)
  const [x, y] = placementScreenPoint.value
  reticleDrag.value =
    axis === undefined
      ? { element, pointerId, offset: [x - clientX, y - clientY] }
      : { element, pointerId, axis, lastClientPosition: axis === 0 ? clientX : clientY }
}

const moveReticle = (event: PointerEvent) => {
  const drag = reticleDrag.value
  if (drag?.pointerId !== event.pointerId) return
  const { clientX, clientY } = event
  const { axis } = drag
  if (axis === undefined) {
    const [offsetX, offsetY] = drag.offset
    placementPoint.value = { position: constrainToViewport([clientX + offsetX, clientY + offsetY]) }
    return
  }

  const clientPosition = axis === 0 ? clientX : clientY
  const delta = clientPosition - drag.lastClientPosition
  if (delta === 0) return
  drag.lastClientPosition = clientPosition

  // 移动当前轴的坐标，另一个轴即使在视口外也保留原值。
  const locked = lockedPlacementCoordinate.value
  const point: DTO.Coordinate2D = [...(locked ?? placementScreenPoint.value)]
  point[axis] += locked ? delta / scaleRatio.value : delta
  if (locked) lockedPlacementCoordinate.value = point
  else placementPoint.value = { position: constrainToViewport(point) }
}

const releaseReticle = () => {
  if (!reticleDrag.value) return
  const { element, pointerId } = reticleDrag.value
  reticleDrag.value = undefined
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId)
}

const endReticleDrag = (event: PointerEvent) => {
  if (reticleDrag.value?.pointerId !== event.pointerId) return
  if (event.type === 'pointerup') moveReticle(event)
  releaseReticle()
}

const cancelRecenter = () => {
  if (recenterFrame !== undefined) cancelAnimationFrame(recenterFrame)
  recenterFrame = undefined
  recenterPoint.value = undefined
}

const focusLockedPlacement = () => {
  const target = lockedPlacementCoordinate.value
  if (!canPlace.value || !placementDirection.value || recentering.value || !target) return
  releaseReticle()
  MapSubject.viewState.next({ target, transitionDuration: 0 })
  mapCanvasRef.value?.focus({ preventScroll: true })
}

const recenterPlacement = (event: MouseEvent) => {
  if (!placing.value || !canPlace.value || recentering.value) return
  releaseReticle()

  const button = event.currentTarget as HTMLButtonElement
  const restoreFocus = document.activeElement === button
  const center = viewportCenter.value
  const [centerX, centerY] = center
  const [x, y] = reticlePosition.value
  const finish = () => {
    placementPoint.value = { position: center, fromViewportSnapshot: true }
    const locked = lockedPlacementCoordinate.value
    if (!preferenceStore.lockPlacementReticle) {
      lockedPlacementCoordinate.value = undefined
    } else if (locked) {
      // 沿用主图投影的尺寸和比例，避免画布尺寸更新不同步时在落点跳动。
      const [projectedX, projectedY] = projectedPosition.value
      const scale = scaleRatio.value
      lockedPlacementCoordinate.value = [
        locked[0] + (centerX - projectedX) / scale,
        locked[1] + (centerY - projectedY) / scale,
      ]
    } else {
      lockedPlacementCoordinate.value = props.getMapCoordinate(center)
    }
    recenterFrame = undefined
    recenterPoint.value = undefined
    if (restoreFocus) {
      void nextTick(() => {
        if (document.activeElement === document.body) button.focus({ preventScroll: true })
      })
    }
  }

  if (
    (x === centerX && y === centerY)
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    finish()
    return
  }

  recenterPoint.value = [x, y]
  let startedAt: number | undefined
  const step = (now: number) => {
    startedAt ??= now
    const progress = Math.min((now - startedAt) / recenterDuration, 1)
    if (progress === 1) {
      finish()
      return
    }
    const eased = 1 - (1 - progress) ** 3
    recenterPoint.value = [x + (centerX - x) * eased, y + (centerY - y) * eased]
    recenterFrame = requestAnimationFrame(step)
  }
  recenterFrame = requestAnimationFrame(step)
}

onBeforeUnmount(() => {
  cancelRecenter()
  releaseReticle()
})

watch(placing, active => {
  if (!active) cancelRecenter()
})

watch(
  () => preferenceStore.lockPlacementReticle,
  locked => {
    if (!placing.value || recentering.value) return
    releaseReticle()
    if (locked) {
      lockedPlacementCoordinate.value = getPlacementCoordinate()
    } else if (lockedPlacementCoordinate.value) {
      placementPoint.value = { position: constrainToViewport(projectedPosition.value) }
      lockedPlacementCoordinate.value = undefined
    }
  },
  { flush: 'sync' },
)

const closeContextMenu = () => {
  contextCoordinate.value = undefined
}

const closeMenus = () => {
  cancelRecenter()
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
  placementPoint.value = point ? { position: point } : undefined
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
    if (recentering.value) return
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
      :style="reticleDimensions"
      :inert="recentering || undefined"
      aria-hidden="true"
      @pointermove="moveReticle"
      @pointerup="endReticleDrag"
      @pointercancel="endReticleDrag"
      @lostpointercapture="endReticleDrag"
    >
      <PlacementGuides
        v-if="placing"
        :point="reticlePosition"
        :square-offset="reticleSquareOffset"
        :viewport="viewport"
        :visible-axes="visibleGuideAxes"
        :active-axis="reticleDrag?.axis"
        @press="startReticleDrag"
      />
      <span
        class="placement-reticle"
        :class="{
          'draggable-reticle': placing && !preferenceStore.lockPlacementReticle,
          'locked-reticle': placing && preferenceStore.lockPlacementReticle,
        }"
        :style="reticleStyle"
        @pointerdown.stop="startReticleDrag($event)"
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

  <button
    v-if="placementDirection"
    type="button"
    class="reticle-direction"
    :data-edge="placementDirection.edge"
    :style="{
      left: `${placementDirection.x}px`,
      top: `${placementDirection.y}px`,
      width: `${directionBadgeSize}px`,
      '--direction-angle': `${placementDirection.angle}deg`,
    }"
    :disabled="recentering || !canPlace"
    :aria-label="`移回锁定点（视口${directionLabels[placementDirection.edge]}）`"
    title="移回锁定点"
    @click="focusLockedPlacement"
    @contextmenu.prevent
  >
    <span class="reticle-direction-arrow" aria-hidden="true" />
  </button>

  <Transition name="placement-menu" @before-leave="makeLeavingInert">
    <div
      v-if="placing || showContextActions"
      ref="contextPanel"
      class="context-menu font-genshin"
      :class="{ 'has-direction': placementDirection }"
      :style="contextMenuPosition"
      :inert="recentering || undefined"
      @click.capture="recentering && $event.stopPropagation()"
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
        <p v-if="placementDirection" class="reticle-direction-note">
          <strong>锁定点在视口外</strong>
          <span>{{
            visibleGuideAxes.some(Boolean)
              ? '点击箭头移回锁定点，或拖动辅助线微调'
              : '点击箭头移回锁定点'
          }}</span>
        </p>
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
          <div class="menu-step placement-adjustments">
            <button type="button" class="menu-button center-button" @click="recenterPlacement">
              中心点
            </button>
            <button
              type="button"
              class="menu-button lock-switch"
              role="switch"
              :aria-checked="preferenceStore.lockPlacementReticle"
              title="平移地图时保留选址坐标，仍可拖动辅助线微调"
              @click="preferenceStore.lockPlacementReticle = !preferenceStore.lockPlacementReticle"
            >
              锁定
              <span class="lock-switch-track" aria-hidden="true" />
            </button>
          </div>
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
.reticle-overlay,
.context-menu {
  --placement-ink: #293a4a;
}

.reticle-overlay {
  --reticle-border-width: 2px;
  position: absolute;
  z-index: 7;
  inset: 0;
  pointer-events: none;
}

.placement-reticle {
  position: absolute;
  display: grid;
  width: calc(2 * var(--reticle-square-offset));
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
  border: var(--reticle-border-width) solid var(--placement-ink);
  border-radius: 50%;
  filter: drop-shadow(#fff 0 0 1px);
}

.reticle-axis {
  position: absolute;
  width: calc(2 * var(--reticle-square-offset));
  pointer-events: none;
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
  border: 1px solid var(--placement-ink);
  background: #f2dfb9;
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
  background: var(--placement-ink);
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

.reticle-direction {
  position: absolute;
  display: grid;
  box-sizing: border-box;
  aspect-ratio: 1;
  place-items: center;
  padding: 0;
  translate: -50% -50%;
  border: 1px solid #e3c795;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 32%, #424d60, #222b3a 74%);
  box-shadow: 0 2px 8px #15203280;
  pointer-events: auto;
}

.reticle-direction::before {
  position: absolute;
  inset: 3px;
  border: 1px solid #dbc49a56;
  border-radius: inherit;
  content: '';
}

.reticle-direction-arrow {
  width: 18px;
  height: 19px;
  rotate: var(--direction-angle);
  background: linear-gradient(#fff5d8, #dab779);
  clip-path: polygon(50% 0, 100% 100%, 50% 74%, 0 100%);
}

.reticle-direction,
.context-menu.has-direction {
  z-index: var(--map-window-layer, 11);
}

.context-menu {
  position: absolute;
  z-index: 10;
  display: flex;
  width: max-content;
  max-width: var(--menu-max-width, calc(100% - 20px));
  max-height: var(--menu-max-height, calc(100% - 20px));
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.context-actions {
  display: grid;
  width: 208px;
  max-width: 100%;
  min-height: 0;
  gap: 8px;
  overflow-y: auto;
  padding: 8px;
  border-radius: 28px;
}

.context-menu .placement-minimap {
  --minimap-size: min(188px, 35vw, 40vh);
}

.context-menu.has-direction .placement-minimap {
  --minimap-size: min(
    188px,
    35vw,
    40vh,
    var(--menu-max-width),
    max(0px, calc(var(--menu-max-height) - 112px))
  );
}

.reticle-direction-note {
  display: grid;
  gap: 3px;
  margin: 0 3px;
  padding: 3px 4px 7px;
  border-bottom: 1px solid #d3bc8e45;
  color: #d3c0a1;
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}

.reticle-direction-note strong {
  color: #f4dfb3;
  font-weight: normal;
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

.placement-adjustments {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.lock-switch {
  justify-content: space-between;
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
.placement-trigger:not(:disabled),
.reticle-direction:not(:disabled) {
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
.placement-trigger:focus-visible,
.reticle-direction:focus-visible {
  outline: 2px solid #ffe2a5;
  outline-offset: 2px;
}

@media (hover: hover) {
  .menu-button:hover,
  .placement-trigger:not(:disabled):hover,
  .reticle-direction:not(:disabled):hover {
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
