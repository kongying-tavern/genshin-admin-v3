<script setup lang="ts">
import type { Observable } from 'rxjs'
import type { MapWindow } from '../types'
import { fromEvent as fromRefEvent, useSubscription } from '@vueuse/rxjs'
import { filter, finalize, map, merge, race, switchMap, takeUntil } from 'rxjs'
import { globalPointerMove$, globalPointerup$, globalTouchend$, globalTouchmove$ } from '@/shared'

const props = defineProps<{
  translate: MapWindow.Coordinate
  size: MapWindow.Size
}>()

const emits = defineEmits<{
  resize: [MapWindow.ResizeProps]
  resizeStart: []
  resizeEnd: []
}>()

const resizerRef = ref<HTMLElement>() as Ref<HTMLElement>

const pointerdown = fromRefEvent(resizerRef, 'pointerdown') as Observable<PointerEvent>

useSubscription(
  pointerdown
    .pipe(
      filter(ev => {
        return [
          ev.button === 0,
          ev.target instanceof HTMLElement,
          props.size !== undefined,
          props.translate !== undefined,
        ].every(condition => condition)
      }),

      switchMap(startEvent => {
        emits('resizeStart')
        const { x: startX, y: startY } = startEvent

        const { x: windowStartX, y: windowStartY } = props.translate
        const { width: windowStartW, height: windowStartH } = props.size

        const classList = (startEvent.target as HTMLElement).classList
        const px = classList.contains('px')
        const py = classList.contains('py')
        const sx = classList.contains('sx')
        const sy = classList.contains('sy')

        const getX = px ? (moveX: number) => windowStartX + moveX - startX : () => undefined
        const getY = py ? (moveY: number) => windowStartY + moveY - startY : () => undefined

        const pxFlagNum = px ? -1 : 1
        const pyFlagNum = py ? -1 : 1

        const getW = sx
          ? (moveX: number) => windowStartW + pxFlagNum * (moveX - startX)
          : () => undefined
        const getH = sy
          ? (moveY: number) => windowStartH + pyFlagNum * (moveY - startY)
          : () => undefined

        const getResizeProps = (moveX: number, moveY: number): MapWindow.ResizeProps => ({
          x: getX(moveX),
          y: getY(moveY),
          width: getW(moveX),
          height: getH(moveY),
        })

        return merge(globalPointerMove$, globalTouchmove$).pipe(
          map(moveEvent => {
            const { x, y } =
              moveEvent instanceof PointerEvent
                ? { x: moveEvent.x, y: moveEvent.y }
                : { x: moveEvent.touches[0].clientX, y: moveEvent.touches[0].clientY }
            emits('resize', getResizeProps(x, y))
          }),

          takeUntil(race(globalPointerup$, globalTouchend$)),

          finalize(() => {
            emits('resizeEnd')
          }),
        )
      }),
    )
    .subscribe(),
)

/**
 * sx: 是否可编辑水平尺寸
 * sy: 是否可垂直水平尺寸
 * px: 是否可移动水平位置
 * py: 是否可垂直水平位置
 */
const resizeFlags = [
  { sx: true, sy: true, px: true, py: true, cursor: 'nwse-resize' }, // 左上
  { sx: false, sy: true, px: false, py: true, cursor: 'ns-resize' }, // 上
  { sx: true, sy: true, px: false, py: true, cursor: 'nesw-resize' }, // 右上
  { sx: true, sy: false, px: false, py: false, cursor: 'ew-resize' }, // 右
  { sx: true, sy: true, px: false, py: false, cursor: 'nwse-resize' }, // 右下
  { sx: false, sy: true, px: false, py: false, cursor: 'ns-resize' }, // 下
  { sx: true, sy: true, px: true, py: false, cursor: 'nesw-resize' }, // 左下
  { sx: true, sy: false, px: true, py: false, cursor: 'ew-resize' }, // 左
]
</script>

<template>
  <div ref="resizerRef" class="window-resizer">
    <div
      v-for="({ cursor, ...flag }, i) in resizeFlags"
      :key="i"
      :class="flag"
      :style="{ cursor }"
      class="resize-controller"
    />
  </div>
</template>

<style scoped>
.window-resizer {
  --controller-size: 16px;
  --offset: -14px;
  --radius: 8px;
  --over: calc(var(--controller-size) + var(--offset));
  --rest: 4px;
  --border-width: 3px;
  --border-color: transparent;

  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  clip-path: polygon(
    50% calc(0% - var(--over)),
    calc(100% + var(--over)) calc(0% - var(--over)),
    calc(100% + var(--over)) calc(100% + var(--over)),
    calc(0% - var(--over)) calc(100% + var(--over)),
    calc(0% - var(--over)) calc(0% - var(--over)),
    50% calc(0% - var(--over)),
    50% var(--rest),
    var(--rest) var(--rest),
    var(--rest) calc(100% - var(--rest)),
    calc(100% - var(--rest)) calc(100% - var(--rest)),
    calc(100% - var(--rest)) var(--rest),
    50% var(--rest)
  );
  user-select: none;
}

.resize-controller {
  --lx: 0;
  --ly: 0;
  --tx: calc(-1 * var(--offset));
  --ty: calc(-1 * var(--offset));
  --w: calc(100% + 2 * var(--offset));
  --h: calc(100% + 2 * var(--offset));
  --rt: 0;
  --rr: 0;
  --rb: 0;
  --rl: 0;

  position: absolute;
  left: var(--lx);
  top: var(--ly);
  transform: translate(var(--tx), var(--ty));
  width: var(--w);
  height: var(--h);
  pointer-events: auto;
  z-index: 1;
  border-color: var(--border-color);
  border-width: calc(var(--rt) * var(--border-width)) calc(var(--rr) * var(--border-width))
    calc(var(--rb) * var(--border-width)) calc(var(--rl) * var(--border-width));
  transition: border-color ease 150ms;

  &:hover {
    --border-color: #7ff5fe;
  }

  &.sx.sy {
    border-radius: calc(var(--rl) * var(--rt) * var(--radius))
      calc(var(--rr) * var(--rt) * var(--radius)) calc(var(--rr) * var(--rb) * var(--radius))
      calc(var(--rl) * var(--rb) * var(--radius));
  }

  &.sx {
    --w: var(--controller-size);
    --lx: calc(100%);
    --tx: calc(var(--offset));
    --rr: 1;
  }

  &.sy {
    --h: var(--controller-size);
    --ly: calc(100%);
    --ty: calc(var(--offset));
    --rb: 1;
  }

  &.px {
    --lx: 0;
    --tx: calc(-100% - var(--offset));
    --rr: 0;
    --rl: 1;
  }

  &.py {
    --ly: 0;
    --ty: calc(-100% - var(--offset));
    --rb: 0;
    --rt: 1;
  }
}
</style>
