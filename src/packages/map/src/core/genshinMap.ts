import type { GenshinMapProps } from '../types'
import { Deck, OrthographicView, TRANSITION_EVENTS } from 'deck.gl'
import { createController } from '../utils'

export class GenshinMap extends Deck<OrthographicView> {
  constructor(canvas: HTMLCanvasElement, props: GenshinMapProps = {}) {
    const { controller = {}, initialViewState = {}, ...rest } = props

    const {
      maxZoom = Number.MAX_SAFE_INTEGER,
      minZoom = Number.MIN_SAFE_INTEGER,
      zoom = 0,
      target = [0, 0],
      transitionDuration = 0,
      transitionEasing = t => t,
      transitionInterruption = TRANSITION_EVENTS.BREAK,
      ...restViewState
    } = initialViewState!

    const {
      doubleClickZoom = false,
      scrollZoom = {},
      inertia = 500,
      ...controllerRest
    } = controller

    const mainView = new OrthographicView({
      id: 'main-view',
      controller: {
        ...controllerRest,
        doubleClickZoom,
        scrollZoom:
          scrollZoom === undefined
            ? false
            : {
                speed: scrollZoom.speed ?? 0.002,
                smooth: true,
              },
        inertia,
        type: createController(props),
      },
    })

    super({
      id: 'genshin-map',
      ...rest,
      eventRecognizerOptions: {
        dblclick: {
          taps: 3, // 禁用双击事件，使其直接触发两次单击
        },
      },
      canvas,
      views: mainView,
      initialViewState: {
        ...restViewState,
        maxZoom,
        minZoom,
        zoom,
        target,
        transitionDuration,
        transitionEasing,
        transitionInterruption,
      },
    })
  }
}
