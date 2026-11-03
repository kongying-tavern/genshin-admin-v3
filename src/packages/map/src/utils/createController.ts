import type { GenshinMapProps } from '..'
import { OrthographicController } from 'deck.gl'

export const createController = (props: GenshinMapProps) => {
  const { scrollZoom } = props.controller ?? {}

  const { transitionDuration: zoomTransitionDuration = 200 } = scrollZoom ?? {}

  return class extends OrthographicController {
    protected override _onWheel(
      ...[event]: Parameters<OrthographicController['_onWheel']>
    ): boolean {
      if (!this.scrollZoom) return false

      const pos = this.getCenter(event)
      if (!this.isPointInBounds(pos, event)) return false
      event.srcEvent.preventDefault()

      const { speed = 0.01, smooth = false } = this.scrollZoom === true ? {} : this.scrollZoom
      const { delta } = event

      let scale = 2 / (1 + Math.exp(-Math.abs(delta * speed)))
      if (delta < 0 && scale !== 0) scale = 1 / scale

      const newControllerState = this.controllerState.zoom({ pos, scale })
      const transitionDuration = smooth
        ? typeof zoomTransitionDuration === 'function'
          ? zoomTransitionDuration()
          : zoomTransitionDuration
        : 0
      this.updateViewport(
        newControllerState,
        { ...this._getTransitionProps({ around: pos }), transitionDuration },
        { isZooming: true, isPanning: true },
      )
      return true
    }
  }
}
