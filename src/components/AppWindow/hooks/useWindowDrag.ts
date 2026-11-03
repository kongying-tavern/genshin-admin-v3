import type { WindowContext } from '../core'
import { useSubscription } from '@vueuse/rxjs'
import { filter, finalize, map, merge, race, switchMap, takeUntil } from 'rxjs'
import {
  globalPointerDown$,
  globalPointerMove$,
  globalPointerup$,
  globalTouchend$,
  globalTouchmove$,
  mapContainerKey,
} from '@/shared'

export const useWindowDrag = (context: WindowContext) => {
  const mapContainer = inject(mapContainerKey, ref())

  const pointerdown = globalPointerDown$.pipe(
    map(ev => {
      const result = ev.composedPath().find(target => {
        if (!(target instanceof HTMLElement)) return false
        return target.dataset[context.dragHookId] !== undefined
      }) as HTMLElement | undefined
      if (!result) return
      return {
        srcEvent: ev,
        target: result,
        panelId: result.dataset[context.dragHookId]!,
      }
    }),
  )

  const optimizeWindowPosition = () => {
    if (!mapContainer.value) return
    const { width, height } = mapContainer.value.getBoundingClientRect()
    context.optimizeWindowPosition({ inlineSize: width, blockSize: height })
  }

  useSubscription(
    pointerdown
      .pipe(
        filter(result => {
          return result !== undefined
        }),
        map(result => {
          context.topping(result!.panelId)
        }),
      )
      .subscribe(),
  )

  useSubscription(
    pointerdown
      .pipe(
        filter(result => {
          if (!result) return false
          if (!(result.srcEvent.target instanceof HTMLElement)) return false
          return result.srcEvent.target.dataset.draggable === 'true'
        }),

        map(result => {
          const { target, srcEvent } = result!
          const panelId = target!.dataset[context.dragHookId]!
          context.setInteractionState(panelId, 'manual')

          const style = getComputedStyle(target!)
          const translate = {
            x: Number(style.getPropertyValue('--tx')),
            y: Number(style.getPropertyValue('--ty')),
          }

          const startPosition = {
            x: srcEvent.x,
            y: srcEvent.y,
          }

          return {
            translate,
            startPosition,
            panelId,
          }
        }),

        switchMap(({ panelId, translate, startPosition }) => {
          return merge(globalPointerMove$, globalTouchmove$).pipe(
            map(moveEvent => {
              const { x, y } =
                moveEvent instanceof PointerEvent
                  ? {
                      x: moveEvent.x,
                      y: moveEvent.y,
                    }
                  : {
                      x: moveEvent.touches[0].clientX,
                      y: moveEvent.touches[0].clientY,
                    }
              context.move(panelId, {
                x: translate.x + x - startPosition.x,
                y: translate.y + y - startPosition.y,
              })
            }),

            takeUntil(race(globalPointerup$, globalTouchend$)),

            finalize(() => {
              context.setInteractionState(panelId, 'default')
              if (!mapContainer.value) return
              const { width, height } = mapContainer.value.getBoundingClientRect()
              context.optimizeWindowPosition({ inlineSize: width, blockSize: height })
            }),
          )
        }),
      )
      .subscribe(),
  )

  useResizeObserver(mapContainer, ([entry]) => {
    const { contentBoxSize: [boxSize] = [] } = entry
    if (boxSize.blockSize === 0 || boxSize.inlineSize === 0) return
    context.optimizeWindowPosition(boxSize)
  })

  return {
    optimizeWindowPosition,
  }
}
