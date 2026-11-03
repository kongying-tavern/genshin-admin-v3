import { LinearInterpolator } from 'deck.gl'

/** 缓动插值器 */
export class EaseoutInterpolator extends LinearInterpolator {
  protected easeOut = (
    a: number | number[],
    b: number | number[],
    t: number,
  ): number | number[] => {
    // 3 阶缓动
    t = 1 - (1 - t) ** 3

    if (Array.isArray(a)) {
      if (!Array.isArray(b)) throw new Error('b is not a array')
      return a.map((ai, i) => this.easeOut(ai, b[i], t) as number)
    }

    return t * (b as number) + (1 - t) * (a as number)
  }

  interpolateProps = (
    ...[startProps, endProps, t]: Parameters<LinearInterpolator['interpolateProps']>
  ) => {
    const propsInTransition: Record<string, number | number[]> = {}

    for (const key of this._propsToExtract)
      propsInTransition[key] = this.easeOut(startProps[key] || 0, endProps[key] || 0, t)

    if (endProps.aroundPosition && this.opts.makeViewport) {
      const viewport = this.opts.makeViewport({ ...endProps, ...propsInTransition })
      Object.assign(
        propsInTransition,
        viewport.panByPosition(
          endProps.aroundPosition,
          this.easeOut(startProps.around || 0, endProps.around || 0, t) as number[],
        ),
      )
    }
    return propsInTransition
  }
}
